var allTabs = {};

var desiredResolution = "1080";
chrome.storage.sync.get({ "resolution": "1080" }, function(data) {
    console.log("Desired resolution is " + data["resolution"] + "p.");
    desiredResolution = data["resolution"];
});

chrome.webRequest.onBeforeRequest.addListener(handleRequest, { urls: ["*://*.hbonow.com/hls*"] }, ["blocking"]);
function handleRequest(details) {
    if (details.url.indexOf("master") != -1) {
        if (details.tabId > -1) {
            console.log("[#" + details.tabId + "] New playlist.");

            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (xhr.readyState == XMLHttpRequest.DONE) {
                    var tabStreams = [];
                    const regex = /.*?(BANDWIDTH)(.*?)(,)(RESOLUTION)(.*?)(,)/i;

                    let m;
                    var currentStream = {};
                    var lines = xhr.responseText.split('\n');
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i].indexOf("EXT-X-STREAM-INF") !== -1) {
                            if ((m = regex.exec(lines[i])) !== null) {
                                let resolution = m[5].replace("=", "").split("x");
                                currentStream["height"] = resolution[1];
                            }
                        } else if (lines[i].indexOf(".m3u8") !== -1) {
                            if (lines[i].indexOf("URI") === -1) {
                                currentStream["url"] = details.url.substring(0, details.url.lastIndexOf("/")) + "/" + lines[i];

                                tabStreams.push(currentStream);
                                currentStream = {};
                            }
                        }
                    }

                    allTabs[details.tabId] = tabStreams;
                }
            }

            xhr.open("GET", details.url);
            xhr.send(null);
        }
    } else {
        if (allTabs.hasOwnProperty(details.tabId)) {
            let streams = allTabs[details.tabId];
            for (var i = 0; i < streams.length; i++) {
                let stream = streams[i];
                if (stream["height"] != desiredResolution) {
                    if (stream["url"] == details.url) {
                        console.log("[#" + details.tabId + "] Cancelled " + stream["height"] + "p.");

                        return {
                            cancel: true
                        };
                    }
                }
            }
        }
    }

    return {
        cancel: false
    };
}

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.event == "resolutionSwitch") {
            console.log("Desired resolution is " + request["value"] + "p.");
            desiredResolution = request["value"];
        }
    }
);

chrome.runtime.onInstalled.addListener(function() {
    chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: {
                        hostContains: "hbonow.com"
                    },
                })
            ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
        }]);
    });
});