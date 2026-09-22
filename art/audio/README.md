# 原型音效

目前使用 `src/services/AudioService.ts` 的 `TONES` 合成短提示音，不依賴外部下載、音檔授權或網路載入。音高、波形、時長與音量包絡均保留在遊戲 Git 中，可重製。

提示包含介面、敵方命中、我方受傷、治療、防禦、勝利與敗退。這些是操作回饋，不是已完成的刀劍、拳掌、環境聲或背景配樂。

`AudioService` 只管理播放與資源生命週期，`SettingsRepository` 保存本機音量。`GameApplication` 將戰鬥事件轉成音效，不在聲音模組改動遊戲規則。音量與角色存檔分開，匯入角色不覆蓋音量偏好。

使用者互動後才建立／恢復 AudioContext。切至背景立即移除排程聲音並暫停 context，回到前景後等下一次互動解鎖，不補播舊聲音。釋放遊戲時關閉 context。

依據 [MDN Web Audio 最佳實務](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) 的互動解鎖及使用者音量控制建議實作。

尚待驗收：實際聽感、不同裝置音量、正式音效與背景音樂。瀏覽器 UI 與 mocked AudioContext 測試不能代替聽感驗收。
