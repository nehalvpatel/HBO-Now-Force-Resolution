chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.event === "restartVideo") {
        if (document.getElementById("video-player")) {
            var player = document.getElementById("video-player").innerHTML;
            document.getElementById("video-player").innerHTML = player;
        }
    }
});