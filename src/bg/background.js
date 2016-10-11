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

chrome.webRequest.onBeforeRequest.addListener(handleRequest, { urls: ["*://*.hbonow.com/*master*m3u8"] }, ["blocking"]);
function handleRequest(details) {
    if (details.tabId > -1) {
        logData(details.tabId, "New playlist.");

        let playlistRequest = new XMLHttpRequest();
        playlistRequest.onreadystatechange = function() {
            if (playlistRequest.readyState == XMLHttpRequest.DONE) {
                if (playlistRequest.getResponseHeader("Content-Type") == "audio/x-mpegurl") {
                    removeListeners(details.tabId);

                    let currentTab = {};
                    currentTab["streams"] = [];
                    currentTab["handlers"] = [];
                    currentTab["resolutions"] = [];

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
                                currentTab["resolutions"].push(height);

                                if (height == desiredResolution) {
                                    hasDesiredHeight = true;
                                }
                            }
                        } else if (playlistLines[i].indexOf(".m3u8") !== -1) {
                            if (playlistLines[i].indexOf("URI") === -1) {
                                currentStream["url"] = details.url.substring(0, details.url.lastIndexOf("/")) + "/" + playlistLines[i];

                                currentTab["streams"].push(currentStream);
                                currentStream = {};
                            }
                        }
                    }

                    if (hasDesiredHeight) {
                        logData(details.tabId, "Has desired height of " + desiredResolution + "p.");
                    } else {
                        logData(details.tabId, "Does not have desired height of " + desiredResolution + "p.");
                    }

                    allTabs[details.tabId] = currentTab;
                    calculateStreams(details.tabId);
                }
            }
        }

        playlistRequest.open("GET", details.url);
        playlistRequest.send(null);
    }

    return {
        cancel: false
    };
}

function resolutionSwitched(resolution) {
    logData(null, "Desired resolution is " + resolution + "p.");

    desiredResolution = parseInt(resolution);

    Object.keys(allTabs).forEach(function (tabId) {
        tabId = parseInt(tabId);
        
        removeListeners(tabId);
        calculateStreams(tabId);
    });
}

function removeListeners(tabId) {
    if (allTabs[tabId]) {
        for (let i = 0; i < allTabs[tabId]["handlers"].length; i++) {
            chrome.webRequest.onBeforeRequest.removeListener(allTabs[tabId]["handlers"][i]);
        }
        
        allTabs[tabId]["handlers"] = [];
    }
}

function calculateStreams(tabId) {
    let allStreams = allTabs[tabId]["streams"];

    let targetResolution = closest(allTabs[tabId]["resolutions"], desiredResolution);
    logData(tabId, "Target resolution is " + targetResolution + "p.");

    for (let i = 0; i < allStreams.length; i++) {
        let currentStream = allStreams[i];
        let handlerIndex;

        if (currentStream["height"] == targetResolution) {
            handlerIndex = allTabs[tabId]["handlers"].push(function(details) {
                let currentResolution = currentStream["height"];
                logData(details.tabId, "Allowed " + currentResolution + "p.");

                chrome.tabs.sendMessage(details.tabId, { "event": "getTitle" }, function(content) {
                    ga("send", "event", "Video", "Play",
                        {
                            "dimension1": content["videoTitle"],
                            "dimension2": desiredResolution + "p",
                            "dimension3": currentResolution + "p"
                        }
                    );
                });

                return {
                    cancel: false
                };
            }) - 1;
        } else {
            handlerIndex = allTabs[tabId]["handlers"].push(function(details) {
                let currentResolution = currentStream["height"];
                logData(details.tabId, "Cancelled " + currentResolution + "p.");

                return {
                    cancel: true
                };
            }) - 1;
        }

        chrome.webRequest.onBeforeRequest.addListener(allTabs[tabId]["handlers"][handlerIndex],
            {
                "urls": [currentStream["url"]],
                "tabId": tabId
            },
            ["blocking"]
        );
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