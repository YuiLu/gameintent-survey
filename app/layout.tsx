import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Game-Intention · 意图标注研究',description:'观看竞技游戏短片段，评价意图标签与描述的画面依据。',robots:{index:false,follow:false}};
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>}
