window.onload = function () {
    initAnalytics("page_action.html");

    chrome.storage.sync.get({ "resolution": 1080 }, function(data) {
        document.getElementById(data["resolution"].toString()).checked = true;
        document.getElementById("nearest").innerText = data["resolution"] + "p";
    });

    var radios = document.forms["quality"].elements["resolution"];
    for(var i = 0; i < radios.length; i++) {
        radios[i].onclick = function() {
            var radio_data = {};
            radio_data["event"] = "resolutionSwitch";
            radio_data["value"] = this.value;

            chrome.storage.sync.set({ "resolution": parseInt(this.value) });
            chrome.runtime.sendMessage(radio_data);
            
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {"event": "restartVideo"});
            });

            document.getElementById("nearest").innerText = this.value + "p";

            ga("send", "event", {
                "eventCategory": "Resolution",
                "eventAction": "Change",
                "eventValue": parseInt(this.value)
            });
        }
    }
}