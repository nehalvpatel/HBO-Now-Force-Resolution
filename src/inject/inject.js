chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg.event === "restartVideo") {
        if (document.getElementById("video-player")) {
            var player = document.getElementById("video-player").innerHTML;
            document.getElementById("video-player").innerHTML = player;
        }
    } else if (msg.event == "getTitle") {
        let videoTitle = "";

        let dataBootstrap = {};
        let dataBootstrapRegex;
        if ((dataBootstrapRegex = document.documentElement.innerHTML.match(/dataBootstrap = (.*),/)) !== null) {
            dataBootstrap = JSON.parse(dataBootstrapRegex[1]);
        }

        if (dataBootstrap.hasOwnProperty("series")) {
            videoTitle = dataBootstrap.series;
        }
        if (dataBootstrap.hasOwnProperty("title")) {
            if (dataBootstrap.hasOwnProperty("series")) {
                videoTitle = videoTitle + ": " + dataBootstrap.title;
            } else {
                videoTitle = dataBootstrap.title;
            }
        }

        let identifier = "";
        if (dataBootstrap.hasOwnProperty("season")) {
            identifier = "S" + pad(dataBootstrap.season, 2);
        }
        if (dataBootstrap.hasOwnProperty("episode")) {
            identifier = identifier + "E" + pad(dataBootstrap.episode, 2);
        }

        if (videoTitle != "") {
            if (identifier != "") {
                videoTitle = videoTitle + " [" + identifier + "]";
            }
        } else {
            videoTitle = document.getElementsByClassName("series-info-wrap")[0].getElementsByClassName("hbo-light")[0].innerText;

            let videoTitleText = document.getElementsByClassName("video-title-text");
            if (Object.keys(videoTitleText).length > 0) {
                videoTitle = videoTitle + ": " + videoTitleText[0].innerText;
            }
        }

        sendResponse({
            "videoTitle": videoTitle
        });
    }
});

function pad(n, width, z) {
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}