var allTabs = {};
var desiredResolution;
const playlistRegex = /.*?(BANDWIDTH)(.*?)(,)(RESOLUTION)(.*?)(,)/i;

initAnalytics("background.html");

chrome.storage.sync.get({ "resolution": 1080 }, function(data) {
    resolutionSwitched(data["resolution"]);
});

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if (request.event == "resolutionSwitch") {
            resolutionSwitched(request["value"]);
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

chrome.webRequest.onBeforeRequest.addListener(handleRequest, { urls: ["*://*.hbonow.com/hls*"] }, ["blocking"]);
function handleRequest(details) {
    if (details.url.indexOf("master") != -1) {
        if (details.tabId > -1) {
            logData(details.tabId, "New playlist.");

            let playlistRequest = new XMLHttpRequest();
            playlistRequest.onreadystatechange = function() {
                if (playlistRequest.readyState == XMLHttpRequest.DONE) {
                    allTabs[details.tabId] = {};
                    allTabs[details.tabId]["allStreams"] = [];
                    allTabs[details.tabId]["resolutions"] = [];

                    let currentStream = {};
                    let hasDesiredHeight = false;
                    let playlistLines = playlistRequest.responseText.split('\n');
                    for (let i = 0; i < playlistLines.length; i++) {
                        if (playlistLines[i].indexOf("EXT-X-STREAM-INF") !== -1) {
                            let matches;
                            if ((matches = playlistRegex.exec(playlistLines[i])) !== null) {
                                let resolution = matches[5].replace("=", "").split("x");
                                let height = parseInt(resolution[1]);

                                currentStream["height"] = height;
                                allTabs[details.tabId]["resolutions"].push(height);

                                if (height == desiredResolution) {
                                    hasDesiredHeight = true;
                                }
                            }
                        } else if (playlistLines[i].indexOf(".m3u8") !== -1) {
                            if (playlistLines[i].indexOf("URI") === -1) {
                                currentStream["url"] = details.url.substring(0, details.url.lastIndexOf("/")) + "/" + playlistLines[i];

                                allTabs[details.tabId]["allStreams"].push(currentStream);
                                currentStream = {};
                            }
                        }
                    }

                    if (hasDesiredHeight) {
                        logData(details.tabId, "Has desired height of " + desiredResolution + "p.");
                    } else {
                        logData(details.tabId, "Does not have desired height of " + desiredResolution + "p.");
                    }

                    calculateStreams(details.tabId);
                }
            }

            playlistRequest.open("GET", details.url);
            playlistRequest.send(null);
        }
    } else {
        if (allTabs.hasOwnProperty(details.tabId)) {
            if (allTabs[details.tabId]["blockedStreams"].hasOwnProperty(details.url)) {
                logData(details.tabId, "Cancelled " + allTabs[details.tabId]["blockedStreams"][details.url] + "p.");

                return {
                    cancel: true
                };
            } else if (allTabs[details.tabId]["allowedStreams"].hasOwnProperty(details.url)) {
                let allowedResolution = allTabs[details.tabId]["allowedStreams"][details.url];
                logData(details.tabId, "Allowed " + allowedResolution + "p.");

                chrome.tabs.sendMessage(details.tabId, { "event": "getTitle", "resolution": allowedResolution }, function(content) {
                    ga("send", "event", {
                        "eventCategory": "Video",
                        "eventAction": "Play",
                        "eventLabel": content["videoTitle"],
                        "eventValue": allowedResolution
                    });
                });
            }
        }
    }

    return {
        cancel: false
    };
}

function resolutionSwitched(resolution) {
    logData(null, "Desired resolution is " + resolution + "p.");

    desiredResolution = parseInt(resolution);

    Object.keys(allTabs).forEach(function (tabId) {
        calculateStreams(tabId);
    });
}

function calculateStreams(tabId) {
    let allStreams = allTabs[tabId]["allStreams"];

    allTabs[tabId]["allowedStreams"] = {};
    allTabs[tabId]["blockedStreams"] = {};

    let targetResolution = closest(allTabs[tabId]["resolutions"], desiredResolution);
    logData(tabId, "Target resolution is " + targetResolution + "p.");

    for (let i = 0; i < allStreams.length; i++) {
        let currentStream = allStreams[i];
        let streamKey;

        if (currentStream["height"] == targetResolution) {
            streamKey = "allowedStreams";
        } else {
            streamKey = "blockedStreams";
        }

        allTabs[tabId][streamKey][currentStream["url"]] = currentStream["height"];
    }
}

function closest(arr, closestTo) {
    let closest = Math.max.apply(null, arr);
    
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] >= closestTo && arr[i] < closest) closest = arr[i];
    }
    
    return closest;
}

function logData(tabId, message) {
    if (tabId !== null) {
        if (message == "New playlist.") {
            console.log("%c[#" + tabId + "] " + message, "font-weight: bold;");
        } else {
            console.log("[#" + tabId + "] " + message);
        }
    } else {
        console.log(message);
    }
}