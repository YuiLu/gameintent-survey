import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Game-Intention · 意图标注研究',description:'观看竞技游戏短片段，评价意图标签与描述的画面依据。',metadataBase:new URL('https://gameintent-survey.magic-lab.tech'),openGraph:{type:'website',title:'看懂操作，也看懂意图｜游戏意图研究',description:'观看游戏短片，判断玩家想要做什么。匿名参与，熟悉其中一款游戏即可。',url:'/',images:[{url:'/share/study-card.png',width:1200,height:630}]},twitter:{card:'summary_large_image'},robots:{index:false,follow:false}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>}
