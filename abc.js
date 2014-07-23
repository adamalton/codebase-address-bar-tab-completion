var abc = {
	// Address Bar Completion

	DEAFULT_NUMBER_OF_SUGGESTIONS: 10,

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


chrome.omnibox.onInputChanged.addListener(abc.onInputChanged);
chrome.omnibox.onInputEntered.addListener(abc.onInputEntered);
chrome.omnibox.onInputStarted.addListener(abc.onInputStarted);


function loadCurrentSite(){
	// TODO: make this flexible so that we can have tab completion for other sites
	return codebaseSite; //loaded from test-site
}


console.log('Address Bar Completion plugin code loaded.');