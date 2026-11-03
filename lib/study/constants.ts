export const VERSION = '2.2';
export const STUDY_ID = 'game-intention-v2';
export const GAMES = [
 {id:'aoe2',en:'Age of Empires II',zh:'帝国时代 II',genre:'RTS',size:18826,color:'#b99761'},
 {id:'wc3',en:'Warcraft III',zh:'魔兽争霸 III',genre:'RTS',size:12025,color:'#7a9178'},
 {id:'pubg',en:'PUBG',zh:'绝地求生',genre:'BR',size:11276,color:'#b99761'},
 {id:'cs',en:'Counter-Strike',zh:'反恐精英',genre:'FPS',size:10479,color:'#748d9a'},
 {id:'valorant',en:'Valorant',zh:'无畏契约',genre:'FPS',size:9347,color:'#ba7777'},
 {id:'lol',en:'League of Legends',zh:'英雄联盟',genre:'MOBA',size:8649,color:'#6f9493'},
 {id:'sc2',en:'StarCraft II',zh:'星际争霸 II',genre:'RTS',size:8428,color:'#788fae'},
 {id:'dota',en:'Dota 2',zh:'刀塔 2',genre:'MOBA',size:5330,color:'#b57768'},
 {id:'rl',en:'Rocket League',zh:'火箭联盟',genre:'SPORT',size:4690,color:'#7798ab'},
 {id:'apex',en:'Apex Legends',zh:'Apex 英雄',genre:'BR',size:2385,color:'#b37872'},
 {id:'overwatch',en:'Overwatch',zh:'守望先锋',genre:'FPS',size:1427,color:'#c49d64'},
] as const;
export const LABEL_OPTIONS = [
 {value:'supported',title:'有明确画面支持',en:'Clearly supported',detail:'目标符合画面。其他意图同时成立，不影响这一选择。'},
 {value:'partly_supported',title:'只有部分符合',en:'Partly supported',detail:'标签含义或标签集合中只有一部分得到支持。'},
 {value:'contradicted',title:'与画面明显不符',en:'Contradicted',detail:'所说的目标或对象与画面冲突。'},
 {value:'insufficient',title:'画面信息不足',en:'Insufficient visual evidence',detail:'看不到足够证据判断目标或所问对象。'},
 {value:'unfamiliar',title:'不熟悉这个具体局面',en:'Unfamiliar situation',detail:'因为缺少相关游戏知识而难以判断。'},
] as const;
export const DESCRIPTION_OPTIONS = [
 {value:'fully_supported',title:'目标与实质细节均有支持',en:'Fully grounded',detail:'可接受不改变含义的措辞差异。'},
 {value:'goal_supported_details_unverified',title:'目标正确，部分细节缺乏依据',en:'Goal supported, details unverified',detail:'描述补充了画面未充分支持的对象、动机或战术关系。'},
 {value:'goal_incorrect',title:'主要目标与画面不符',en:'Incorrect goal',detail:'描述的核心目标或对象有明显错误。'},
 {value:'insufficient',title:'画面信息不足',en:'Insufficient visual evidence',detail:'连主要目标也难以从这段画面判断。'},
 {value:'unfamiliar',title:'不熟悉这个具体局面',en:'Unfamiliar situation',detail:'因为缺少相关游戏知识而难以判断。'},
] as const;
export const DEFAULT_CONFIG = {version:VERSION,title:'Game-Intention',datasetRevision:'',contact:'',compensation:'',privacy:'不收集真实姓名、游戏账号或联系方式。我们会记录回答、观看与播放状态；研究结果以去标识形式保存和发布。',privacyEn:'We do not collect real names, gaming accounts, or contact details. We record responses and video playback information. Research results are stored and released in de-identified form.',clipsPerGame:40,ratersPerClip:5,participantsPerGame:20,mainPerParticipant:10,seed:'game-intention-v2-2026',bootstrapReplicates:5000,gameSizes:Object.fromEntries(GAMES.map(g=>[g.id,g.size]))};
export type LabelJudgment = typeof LABEL_OPTIONS[number]['value'];
export type DescriptionJudgment = typeof DESCRIPTION_OPTIONS[number]['value'];
export type StudyQuestion = {id:string;game:string;video_id:string;target_id:string;source_cluster_id:string;dataset_revision:string;video_url:string;task_en:string;task_zh:string;labels:{id:string;en:string;zh:string;definition_en:string;definition_zh:string}[];description_en:string;description_zh:string;translation_status:'pending'|'machine'|'reviewed';translation_provenance?:string;label_scope:string;video_sha256?:string;duration:number;kind:'main'|'practice'|'control_positive'|'control_negative';media_verified:boolean;reviewed:boolean;expected?:{label_support:string;description_support:string};provenance?:Record<string,unknown>};
