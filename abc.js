var abc = {
	// Address Bar Completion

	DEFAULT_NUMBER_OF_SUGGESTIONS: 10,
	MINIMUM_TYPED_BEFORE_LOOKUP: 3,

	// move this logic into an abortable promise
	currentQuery: '',


	// Using localstorage because chrome.storage is asynchronous which is a pain to code with
	siteLocalStorageKey: 'cb-abc-site', // The localStorage key where we store the user's codebase site info
	currentSite: null, // the site that we're basing our auto-completion on

	// current suggestions
	// previous suggestion object
	// turn it into an async function

	// this is wrapped so that later we can implement a pop
	// for the cache so we don't max it out (or potentially local storage)
	siteCache: {
		items: {},
		put: function(text, result){
			abc.siteCache.items[text] = result
		},
		get: function(text){
			return abc.siteCache.items[text]
		},
		getSuperSet: function(text){
			// sort keys by length, return the largest
			// that begins with the text
			var keys = Object.keys(abc.siteCache.items);
			keys.sort(function(a, b){
				if(a > b){
					return -1;
				}
				if(a < b){
					return 1;
				}
				return 0;
			});

			for(var k=0; k<keys.length; k++){
				var key = keys[k];

				if(text.startsWith(key)){
					return abc.siteCache.items[key]
				}
			}

			return [];
		}
	},


	onInputStarted: function(){
		abc.currentSite = loadCurrentSite();
	},

	onInputChanged: function(text, suggest){
		var result;

		if(text.length < abc.MINIMUM_TYPED_BEFORE_LOOKUP){
			return
		}
		abc.currentQuery = text;

		result = abc.getSuggestions(text);

		if(result){
			var suggestions = result[0];
			var default_suggestion = result[1];
			suggest(suggestions);
			chrome.omnibox.setDefaultSuggestion(default_suggestion);
		}
	},

	getSuggestions: function(text, _limit, promise){
		// Given the current text in the address bar, return an array of:
		// [suggestions, default_suggestion]
		var limit = _limit || abc.DEFAULT_NUMBER_OF_SUGGESTIONS;
		var search_parts = text.split(/\s+/);
		var site_paths;

		matches = abc.siteCache.get(text);

		if(!matches){
			site_paths = abc.siteCache.getSuperSet(text).map(function(s){
				return s.site_path;
			});

			if(!site_paths.length){
				site_paths = abc.currentSite.paths;
			}

			var matches = [];
			for(var i=0; i<site_paths.length; i++){
				if(text != abc.currentQuery){
					return;
				}
				var site_path = site_paths[i];
				var score = 0;
				var path_parts = site_path.path_parts ? site_path.path_parts : [site_path.path];
				var regex_part_matches = [];

				for(var j=0; j<search_parts.length; j++){

					var search_part = search_parts[j];
					var existing_score = score;
					for(var k=0; k<path_parts.length; k++){
						if(text != abc.currentQuery){
							return;
						}
						var path_part = path_parts[k];
						if(typeof(path_part) === "string"){
							if(path_part.includes(search_part)){
								score += search_part.length;
								break;
							}
						}else{ // the path_part is a regex
							// convert the regex so that it must match the *whole* search part
							var regex = RegExp("^" + path_part.toString().replace(/^\/|\/$/g, '') + "$");
							if(regex.test(search_part)){
								score += search_part.length;
								regex_part_matches[k] = search_part;
								break;
							}
						}
					}
					if(score == existing_score){
						// if the score has not increased then this search part didn't match anything in
						// this site path, so discard the path, don't bother checking further search parts
						score = 0; // prevent this site path from being added to the matches
						break;
					}
				}
				if(score){
					matches.push({
						score: score,
						priority: typeof(site_path.priority) == "undefined" ? 1 : site_path.priority,
						url: abc.buildURLFromParts(abc.currentSite.baseURL, path_parts, regex_part_matches),
						title: abc.buildTitleFromParts(site_path.title, regex_part_matches),
						site_path: site_path
					});

				}
			}

			if(matches.length){
				abc.siteCache.put(text, matches);
			}
		}

		// Now sort our matches by score, highest score first, i.e. reverse order
		return abc.orderAndProcessMatches(text, matches, limit);
	},

	orderAndProcessMatches: function(text, matches, limit){
		// orders the matches and processes them into xml for Chrome to read
		var suggestions = [];
		var default_suggestion = abc.formatDefaultSuggestion(text, '');
		matches.sort(abc.matchComparison);
		for(var i=0; i<matches.length && i<limit; i++){
			var match = matches[i];
			if(i === 0){
				default_suggestion = abc.formatDefaultSuggestion(match.url, match.title);
				continue;
			}
			suggestions.push(abc.formatSuggestion(match.url, match.title));
		}
		return [suggestions, default_suggestion];
	},

	matchComparison: function(a, b){
		// The matches should be sorted highest score first (i.e. descending), using the `priority`
		// to distinguish any with the same score
		if(a.score === b.score){
			return b.priority - a.priority;
		}
		return b.score - a.score;
	},

	buildURLFromParts: function(base_url, path_parts, regex_part_matches){
		// given the base URL of the site (i.e. http://domain) plus the parts of the path and an
		// array of the bits of the search query which matched the regex parts of the path, put
		// them all together to make the full URL.  Note that the regex_part_matches are indexed
		// based on their positions in the URL parts, not sequentitally.
		var url = base_url;
		for(var i=0; i<path_parts.length; i++){
			var path_part = path_parts[i];
			if(typeof(path_part) === "string"){
				url += path_part;
			}else{
				url += regex_part_matches[i];
			}
		}
		return url;
	},

	buildTitleFromParts: function(title, regex_part_matches){
		// URL titles can be given in the format "Search for {0} on Carrot Site", this formats
		// the title using the matched regex parts from the search query
		return title;
		// TODO
		var parts = title.split(/\{\d+\}/g);
		return title.formatUnicorn(regex_part_matches);
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

	onInputEntered: function(url){
		// TODO not nice but setDefaultSuggestion doesn't seem to work as
		// docs suggest, this works around that
		if(!url.startsWith("http") && !url.startsWith("https")){
			var possible = abc.siteCache.get(url);
			if(possible){
				url = possible[0].url;
			}
		}
		chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
			chrome.tabs.update(tabs[0].id, {url: url});
		});
	}

};

function loadCurrentSite(){
	// TODO: make this flexible so that we can have tab completion for other sites
	var data = localStorage.getItem(abc.siteLocalStorageKey);
	if(!data){
		alert("Please set your codebase credentials via the button next to the address bar.");
	}
	var site = JSONX.parse(data);
	return site;
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
	paths: [
		{
			path: "/Logout",
			title: "Logout"
		},
		{
			path_parts: ["/search?q=", /.+/],
			title: "Search for {0}"
		},
		{
			path: "/Logout",
			title: "Logout",
			priority: 0
		}
	]
};

*/
