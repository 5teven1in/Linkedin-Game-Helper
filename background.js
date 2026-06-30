// https://www.linkedin.com/games/mini-sudoku/
// https://www.linkedin.com/games/tango/
// https://www.linkedin.com/games/queens/
// https://www.linkedin.com/games/pinpoint/
// https://www.linkedin.com/games/crossclimb/

const TARGET_URL = "https://www.linkedin.com/games/";
const CLOSE_DELAY_MINUTES = 1;

const scheduleNextOpen = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(17, 47, 0, 0);
    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }
    chrome.alarms.create("open_page", { when: next.getTime() });
}

chrome.runtime.onInstalled.addListener(() => {
    scheduleNextOpen();
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name === "open_page") {
        chrome.tabs.create({ url: TARGET_URL }, tab => {
            chrome.alarms.create(`close_${tab.id}`, { delayInMinutes: CLOSE_DELAY_MINUTES });
        });
        scheduleNextOpen();
    }
});

chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name.startsWith("close_")) {
        const tabId = Number(alarm.name.split("_")[1]);
        chrome.tabs.remove(tabId);
    }
});
