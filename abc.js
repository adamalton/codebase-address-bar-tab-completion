var abc = {
	// Address Bar Completion

	DEAFULT_NUMBER_OF_SUGGESTIONS: 10,

	// Using localstorage because chrome.storage is asynchronous which is a pain to code with
	siteLocalStorageKey: 'cb-abc-site', // The localStorage key where we store the user's codebase site info
	currentSite: null, // the site that we're basing our auto-completion on

	onInputStarted: function(){
		console.log("onInputStarted");
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
		var search_parts = text.split(/\s+/);
		var suggestions = [];
		var default_suggestion = abc.formatDefaultSuggestion(text, '');
		var site_paths = abc.currentSite.paths;
		var matches = [];
		for(var i=0; i<site_paths.length; i++){
			var site_path = site_paths[i];
			var score = 0;
			var path_parts = site_path.path_parts ? site_path.path_parts : [site_path.path];
			var regex_part_matches = [];
			for(var j=0; j<search_parts.length; j++){
				var search_part = search_parts[j];
				var existing_score = score;
				for(var k=0; k<path_parts.length; k++){
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
					console.log('no matches for search part "'+ search_part +'" on site path "' + (path_parts.join('')) + '"');
					score = 0; // prevent this site path from being added to the matches
					break;
				}
			}
			if(score){
				matches.push([
					score,
					abc.buildURLFromParts(abc.currentSite.baseURL, path_parts, regex_part_matches),
					abc.buildTitleFromParts(site_path.title, regex_part_matches)
				]);
			}
		}
		// Now sort our matches by score, highest score first, i.e. reverse order
		matches.sort(function(a, b){ return b[0] - a[0]; });
		for(var i=0; i<matches.length; i++){
			var match = matches[i];
			suggestions.push(abc.formatSuggestion(match[1], match[2]));
		}
		if(matches.length){
			default_suggestion = abc.formatDefaultSuggestion(matches[0][1], matches[0][2]);
		}
		console.log('suggestions');
		console.log(suggestions);
		return [suggestions, default_suggestion];
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

	getFullUrl: function(text){
		// TODO: sort out whether we use this or format them beforehand
		return text;
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
	var data = localStorage.getItem(abc.siteLocalStorageKey);
	if(!data){
		alert("Please set your codebase credentials via the button next to the address bar.");
	}
	var site = JSONX.parse(data);
	console.log("site...");
	console.log(site);
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
		}
	]
};

*/
