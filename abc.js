var abc = {
	// Address Bar Completion

	DEAFULT_NUMBER_OF_SUGGESTIONS: 10,

	// Using localstorage because chrome.storage is asynchronous which is a pain to code with
	siteLocalStorageKey: 'cb-abc-site', // The localStorage key where we store the user's codebase site info
	currentSite: null, // the site that we're basing our auto-completion on

	onInputStarted: function(){
		abc.currentSite = loadCurrentSite();
	},

	onInputChanged: function(text, suggest){
		var result = abc.getSuggestions(text);
		var suggestions = result[0];
		var default_suggestion = result[1];
		suggest(suggestions);
		chrome.omnibox.setDefaultSuggestion(default_suggestion);
	},

	onInputEntered: function(text){
		// Text will be just the path (without the domain).  Navigate to the full URL.
		abc.navigate(abc.getFullUrl(text));
	},

	getSuggestions: function(text, _limit){
		// Given the current text in the address bar, return an array of:
		// [suggestions, default_suggestion]
		var limit = _limit || abc.DEAFULT_NUMBER_OF_SUGGESTIONS;
		if(text[0] !== "/"){
			text = "/" + text;
		}
		var suggestions = [];
		var default_suggestion = abc.formatDefaultSuggestion(text, '');
		function findMatches(tree){
			// Given the (remaining branch of the) site tree, recursively work down through it
			// until the URL is a
			var url, page, subtree, description;
			for(url in tree){
				if(suggestions.length >= limit){
					return;
				}
				if(tree.hasOwnProperty(url)){ //if it's actually one of the object properties
					page = tree[url];
					description = page[0];
					subtree = page[1];

					if(url == text){
						default_suggestion = abc.formatDefaultSuggestion(url, description);
					}
					if(text.substr(0, url.length) === url){
						// The URL is a sub-string of the text, so go down to the next level.
						// It's important that we do the further levels down we can first.
						findMatches(subtree);
					}else if(url.substr(0, text.length) === text){
						// The text is a sub-string of the URL, so it's a match!
						suggestions.push(
							abc.formatSuggestion(url, description)
						);

					}
				}
			}
		}
		findMatches(abc.currentSite.tree); // TODO: don't hard code this to one site map
		return [suggestions, default_suggestion];
	},

	formatSuggestion: function(url, description){
		// Turn the given URL and description into a suggestion object for Chrome.
		return {
			content: url,
			description: '<url>' + url + '</url> ' + description + ' <dim> - ' + abc.currentSite.name + '</dim>'
		};
	},

	formatDefaultSuggestion: function(url, description, include_content){
		// Turn the given URL and description into a suggestion object for chrome.omnibox.setDefaultSuggestion.
		return {
			description: '<url>' + url + '</url> ' + description + ' <dim> - ' + abc.currentSite.name + '</dim>'
		};
	},

	getFullUrl: function(text){
		return abc.currentSite.baseURL + text;
	},

	navigate: function(url){
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.tabs.update(tabs[0].id, {url: url});
		});
	}

};

function loadCurrentSite(){
	// TODO: make this flexible so that we can have tab completion for other sites
	var site = localStorage.getItem(abc.siteLocalStorageKey);
	if(!site){
		alert("Please set your codebase credentials via the button next to the address bar.");
	}
	return JSON.parse(site);
}

chrome.omnibox.onInputChanged.addListener(abc.onInputChanged);
chrome.omnibox.onInputEntered.addListener(abc.onInputEntered);
chrome.omnibox.onInputStarted.addListener(abc.onInputStarted);




console.log('Address Bar Completion plugin code loaded.');

/*
	EXAMPLE SITE

	This is the format which the site map needs to be in.


var site = {
	name: "Codebase",
	baseURL: "https://company-name.codebasehq.com",
	tree: {
		"/projects": [
			"Projects",
			{
				"/projects/project-name": [
					"Project Name",
					{
						"/projects/project-name/tickets": [
							"Project Name Tickets", {}
						],
						"/projects/project-name/objects": [
							"Project Name Objects", {}
						],
						"/projects/project-name/watching": [
							"Project Name Notifications", {}
						]
					}
				],
				"/projects/my-other-project": [
					"My Other Project",
					{
						"/projects/my-other-project/tickets": [
							"My Other Project Tickets", {}
						],
						"/projects/my-other-project/objects": [
							"My Other Project Objects", {}
						],
						"/projects/my-other-project/watching": [
							"My Other Project Notifications", {}
						]
					}
				]
			}
		],
		"/logout": [
			"Logout", {}
		],
		"/notifications": [
			"Notifications", {}
		],
		"/search?q=": [
			"Search (enter query)", {}
		],
		"/settings/profile": [
			"My Profile", {}
		],
		"/settings/password": [
			"Change My Password", {}
		],
		"/support": [
			"Help &amp; Support", {}
		]
	}
};

*/
