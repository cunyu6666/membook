/**
 * [WHO]: React应用入口点，挂载App组件到DOM
 * [FROM]: 依赖React 19、Remix Icon字体、全局样式、App组件
 * [TO]: 浏览器渲染目标，被index.html的#root元素消费
 * [HERE]: src/main.tsx，前端应用启动入口，与App.tsx直接相邻
 */
import React from "react";
import ReactDOM from "react-dom/client";
import "remixicon/fonts/remixicon.css";
import "./styles.css";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
