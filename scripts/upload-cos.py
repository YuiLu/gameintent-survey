"""Batch upload the frozen study clips to COS; never prints credentials or signed URLs.

Credentials come only from COS_SECRET_ID / COS_SECRET_KEY environment variables.
Uses standard-library HTTP and SSH, checks source SHA-256 and remote bytes.
"""
import argparse, base64, concurrent.futures, hashlib, hmac, json, os, pathlib, re
import subprocess, threading, time, urllib.request, urllib.parse, urllib.error

ROOT = pathlib.Path(__file__).resolve().parents[1]

def authorization(method, path, host, secret_id, secret_key):
    now = int(time.time()); period = f'{now-60};{now+1800}'
    enc = lambda v: urllib.parse.quote(v, safe='~')
    canonical = f'{method.lower()}\n{path}\n\nhost={enc(host)}\n'
    digest = hashlib.sha1(canonical.encode()).hexdigest()
    sign_key = hmac.new(secret_key.encode(), period.encode(), hashlib.sha1).hexdigest()
    signature = hmac.new(sign_key.encode(), f'sha1\n{period}\n{digest}\n'.encode(), hashlib.sha1).hexdigest()
    return f'q-sign-algorithm=sha1&q-ak={secret_id}&q-sign-time={period}&q-key-time={period}&q-header-list=host&q-url-param-list=&q-signature={signature}'

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bucket',required=True); parser.add_argument('--region',required=True)
    parser.add_argument('--workers',type=int,default=4); parser.add_argument('--only',default='')
    parser.add_argument('--local-dir',help='Optional question-id.mp4 folder; otherwise reads original server files over SSH')
    parser.add_argument('--output',default='work/cos-upload-receipt.json')
    args=parser.parse_args()
    if not re.fullmatch(r'[a-z0-9-]+-\d+',args.bucket) or not re.fullmatch(r'ap-[a-z0-9-]+',args.region):
        parser.error('Use the actual BucketName-APPID and region code, not a storage-package ID')
    sid=os.environ.get('COS_SECRET_ID'); key=os.environ.get('COS_SECRET_KEY')
    if not sid or not key: parser.error('Set COS_SECRET_ID and COS_SECRET_KEY using hidden terminal input')
    host=f'{args.bucket}.cos.{args.region}.myqcloud.com'
    def request(method,path,data=None,headers=None):
        req=urllib.request.Request('https://'+host+path,data=data,method=method,headers={
            'Authorization':authorization(method,path,host,sid,key),**(headers or {})})
        return urllib.request.urlopen(req,timeout=300)
    questions=json.loads((ROOT/'data/pool.json').read_text())
    rows=[q for q in questions if not args.only or q['id']==args.only]
    if not rows: parser.error('Unknown question ID')
    out=ROOT/args.output; out.parent.mkdir(parents=True,exist_ok=True)
    assets=[]; failed=[]; lock=threading.Lock()
    def one(q):
        path='/study-v2/videos/'+q['id']+'.mp4'
        expected=q['video_sha256']; size=q['provenance']['video_bytes']
        for attempt in range(3):
            try:
                exists=False
                try:
                    with request('HEAD',path) as r:
                        exists=r.headers.get('x-cos-meta-sha256')==expected and int(r.headers.get('Content-Length','0'))==size
                        if not exists: raise ValueError('Existing object differs; refusing overwrite')
                except urllib.error.HTTPError as e:
                    if e.code!=404: raise
                if not exists:
                    if args.local_dir: data=(pathlib.Path(args.local_dir)/(q['id']+'.mp4')).read_bytes()
                    else:
                        ssh='rtx7_35981' if q['game'] in ['apex','overwatch'] else 'a1_game'
                        program='import pathlib,sys;sys.stdout.buffer.write(pathlib.Path('+repr(q['provenance']['native_video_path'])+').read_bytes())'
                        data=subprocess.run(['ssh','-4','-o','BatchMode=yes','-o','ClearAllForwardings=yes','-o','ConnectTimeout=15',ssh,'python3','-'],input=program.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=True,timeout=240).stdout
                    if len(data)!=size or hashlib.sha256(data).hexdigest()!=expected: raise ValueError('Source checksum mismatch')
                    md5=base64.b64encode(hashlib.md5(data).digest()).decode()
                    with request('PUT',path,data,{'Content-Type':'video/mp4','Content-Disposition':'inline',
                        'Content-MD5':md5,'x-cos-meta-sha256':expected,'Cache-Control':'private, max-age=3600'}) as r: r.read()
                    del data
                # Verify full remote content, not just caller-supplied metadata/ETag.
                digest=hashlib.sha256(); received=0
                with request('GET',path) as r:
                    while True:
                        block=r.read(1024*1024)
                        if not block: break
                        digest.update(block); received+=len(block)
                if received!=size or digest.hexdigest()!=expected: raise ValueError('Remote checksum mismatch')
                with lock:
                    assets.append({'question_id':q['id'],'sha256':expected,'bytes':size})
                    payload={'bucket':args.bucket,'region':args.region,'verified_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'assets':assets}
                    tmp=out.with_suffix('.tmp'); tmp.write_text(json.dumps(payload,indent=2)); tmp.replace(out)
                    print(f'Verified {len(assets)}/{len(rows)} {q["id"]}',flush=True)
                return
            except Exception as e:
                # Avoid printing exception strings: upstream libraries may include credentials/URLs.
                with lock: print('Retry',q['id'],attempt+1,type(e).__name__,getattr(e,'code',''),flush=True)
                time.sleep(attempt+1)
        with lock: failed.append(q['id'])
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1,min(args.workers,8))) as executor:
        list(executor.map(one,rows))
    print(json.dumps({'verified':len(assets),'failed':failed,'receipt':str(out)}))
    return bool(failed)

if __name__=='__main__': raise SystemExit(main())
