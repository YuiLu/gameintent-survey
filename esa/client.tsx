import {secureStudyUrl} from '../lib/study/secure-url.mjs';
import {createRoot} from 'react-dom/client';
import App from '../app/page';
import '../app/globals.css';
const secureUrl=secureStudyUrl(window.location.href);
if(secureUrl)window.location.replace(secureUrl);
else createRoot(document.getElementById('root')!).render(<App/>);
