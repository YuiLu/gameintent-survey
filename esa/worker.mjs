import {proxyStudyApi} from '../lib/study/gateway.mjs';
export default {fetch(request, context, env){return proxyStudyApi(request,env);}};
