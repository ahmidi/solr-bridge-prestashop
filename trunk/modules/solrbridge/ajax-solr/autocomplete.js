/**
*  Ajax Autocomplete for jQuery, version 1.1.3
*  (c) 2010 Tomas Kirda
*
*  Ajax Autocomplete for jQuery is freely distributable under the terms of an MIT-style license.
*  For details, see the web site: http://www.devbridge.com/projects/autocomplete/jquery/
*
*  Last Review: 04/19/2010
*/

(function($) {

  function Autocomplete(el, options) {
    this.el = $(el);
    this.el.attr('autocomplete', 'off');
    this.suggestions = [];
    this.spellsuggestions = [];
    this.data = [];
    this.badQueries = [];
    this.selectedIndex = -1;
    this.currentValue = this.el.val();
    this.intervalId = 0;
    this.pimages = [];
    this.pids = [];

    this.didyoumeantext= '';
    this.incorrectkeywords = [];

    this.cachedResponse = [];
    this.onChangeInterval = null;
    this.ignoreValueChange = false;
    this.serviceUrl = options.serviceUrl;
    this.isLocal = false;
    this.options = {
      autoSubmit: true,
      minChars: 1,
      maxHeight: '100px',
      deferRequestBy: 0,
      width: 0,
      highlight: true,
      params: {},
      fnFormatResult: fnFormatResult,
      delimiter: null,
      zIndex: 9999
    };
    this.initialize();
    this.setOptions(options);
    this.facets = true;
    this.fq = '';
  }

  $.fn.autocomplete = function(options) {
    return new Autocomplete(this.get(0)||$('<input />'), options);
  };

  Autocomplete.prototype = {

    killerFn: null,

    initialize: function() {

		var me, uid, autocompleteElId;
		me = this;
		//Initiate a new random id
		uid = Math.floor(Math.random()*0x100000).toString(16);
		autocompleteElId = 'Autocomplete_' + uid;

		this.killerFn = function(e) {
			if ($(e.target).parents('.search_left').size() === 0) {
			  me.killSuggestions();
			  me.disableKillerFn();
			}
		};

		if (!this.options.width) { this.options.width = this.el.width(); }
		this.mainContainerId = 'AutocompleteContainter_' + uid;
		//Set up the suggestion board (suggestion container) which includes product name box, category box, manufacturer box
		$('<div id="'+this.mainContainerId+'" class="search_div" style="display:none;" ><div id="didyoumean" class="txt_suggestion didyoumean" >'+txt_suggestion+'<span id="didyoumean_text"></span>'+'</div><div class="search_left" id="' + autocompleteElId + '" ></div><div class="search_right" id="category_' + autocompleteElId + '"></div><div class="search_bottom"></div></div>').appendTo('body');

		this.container = $('#' + autocompleteElId);
		this.catContainer = $('#category_' + autocompleteElId);
		$('#didyoumean').hide();

		this.fixPosition();

		if (window.opera) {
			this.el.keypress(function(e) { me.onKeyPress(e); });
		} else {
			this.el.keydown(function(e) { me.onKeyPress(e); });
		}
		this.el.keyup(function(e) { me.onKeyUp(e); });
		this.el.blur(function() { me.enableKillerFn(); });
		this.el.focus(function() { me.fixPosition(); });
    },

    setOptions: function(options){
      var o = this.options;
      $.extend(o, options);
      if(o.lookup){
        this.isLocal = true;
        if($.isArray(o.lookup)){ o.lookup = { suggestions:o.lookup, data:[] }; }
      }
      $('#'+this.mainContainerId).css({ zIndex:o.zIndex });
	  this.container.css({  width:'420px' });
    },

    clearCache: function(){
      this.cachedResponse = [];
      this.badQueries = [];
    },

    disable: function(){
      this.disabled = true;
    },

    enable: function(){
      this.disabled = false;
    },

    fixPosition: function() {
      var offset = this.el.offset();
      $('#' + this.mainContainerId).css({ top: (offset.top + this.el.innerHeight()) + 'px', left: (offset.left - 50)+'px' });
    },

    enableKillerFn: function() {
      var me = this;
      $(document).bind('click', me.killerFn);
    },

    disableKillerFn: function() {
      var me = this;
      $(document).unbind('click', me.killerFn);
    },

    killSuggestions: function() {
      var me = this;
      this.stopKillSuggestions();
      this.intervalId = window.setInterval(function() { me.stopKillSuggestions(); }, 300);
    },

    stopKillSuggestions: function() {
      window.clearInterval(this.intervalId);
    },

    onKeyPress: function(e) {
      if (this.disabled ) {
      	return;
      }
      switch (e.keyCode) {
        case 27: //KEY_ESC:
          this.el.val(this.currentValue);
          this.hide();
          break;
        case 9: //KEY_TAB:
        case 13: //KEY_RETURN: ENTER KEY
          if (this.selectedIndex === -1) {
            this.hide();
            return;
          }
          this.select(this.selectedIndex);
          if(e.keyCode === 9){ return; }
          break;
        case 38: //KEY_UP:
          this.moveUp();
          break;
        case 40: //KEY_DOWN:
          this.moveDown();
          break;
        default:
          return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
    },

    onKeyUp: function(e) {
      if(this.disabled ){
      	return;
      }
      switch (e.keyCode) {
        case 38: //KEY_UP:
        case 40: //KEY_DOWN:
          return;
      }
      clearInterval(this.onChangeInterval);
      if (this.currentValue !== this.el.val()) {
        if (this.options.deferRequestBy > 0) {
          // Defer lookup in case when value changes very quickly:
          var me = this;
          this.onChangeInterval = setInterval(function() { me.onValueChange(); }, this.options.deferRequestBy);
        } else {
          this.onValueChange();
        }
      }
    },

	/**
	* onValueChange is a function which will be invoked whenever value in the search box changes.
	*/
    onValueChange: function() {
      clearInterval(this.onChangeInterval);
      this.currentValue = this.el.val();
	  var q = this.currentValue;
	  this.q = q;
      this.selectedIndex = -1;
      if (this.ignoreValueChange) {
        this.ignoreValueChange = false;
        return;
      }
      if (q === '' || q.length < this.options.minChars || q.length < 0 || q.length === 0) {
        this.hide();
      } else {
        this.getSuggestions(q);
      }
    },

    getQuery: function(val) {
      var d, arr;
      d = this.options.delimiter;
      if (!d) { return $.trim(val); }
      arr = val.split(d);
      return $.trim(arr[arr.length - 1]);
    },
	/**
	* getSuggestionsLocal is the function will be invoked static data suggestion instead of ajax suggestion
	*/
    getSuggestionsLocal: function(q) {
      var ret, arr, len, val, i;
      arr = this.options.lookup;
      len = arr.suggestions.length;
      ret = { suggestions:[], data:[] };
      q = q.toLowerCase();
      for(i=0; i< len; i++){
        val = arr.suggestions[i];
        if(val.toLowerCase().indexOf(q) === 0){
          ret.suggestions.push(val);
          ret.data.push(arr.data[i]);
        }
      }
      return ret;
    },
	/**
	* getSuggestion is the function which will be invoked if any value changed in the search box
	*/
    getSuggestions: function(q) {
      var cr, me;
      cr = this.isLocal ? this.getSuggestionsLocal(q) : this.cachedResponse[q];
      if (cr && $.isArray(cr.suggestions)) {
        this.suggestions = cr.suggestions;
        this.data = cr.data;
        this.suggest();
      } else if (!this.isBadQuery(q)) {

        me = this;

		var extraParams = {
			timestamp: +new Date()
		};
		$.each(extraParams, function(key, param) {
			extraParams[key] = typeof param == "function" ? param() : param;
		});
		if(typeof AutoCompleteManager.currentRequest !== 'undefined') AutoCompleteManager.currentRequest.abort();
		//Request the Solr server to get products suggestion
		AutoCompleteManager.store.addByValue('q', 'autosuggest:'+q);
		AutoCompleteManager.store.addByValue('json.nl', 'map');
		AutoCompleteManager.store.addByValue('rows', '50');
		AutoCompleteManager.store.addByValue('fl', 'autosuggest,products_image,products_id');
		AutoCompleteManager.store.addByValue('spellcheck', 'true');
		AutoCompleteManager.store.addByValue('spellcheck.collate', 'true');

		AutoCompleteManager.store.addByValue('facet', 'true');
		AutoCompleteManager.store.addByValue('facet.field', 'category');
		AutoCompleteManager.store.addByValue('facet.field', 'manufacturers_name');
		if(this.fq.length > 0){
			AutoCompleteManager.store.addByValue('fq', this.fq);
		}
		AutoCompleteManager.store.addByValue('facet.limit', '10');
		AutoCompleteManager.store.addByValue('timestamp', new Date());

		AutoCompleteManager.doRequest();
      }
    },

    isBadQuery: function(q) {
      var i = this.badQueries.length;
      while (i--) {
        if (q.indexOf(this.badQueries[i]) === 0) { return true; }
      }
      return false;
    },

    hide: function() {
      this.enabled = false;
      this.selectedIndex = -1;
	  $('#'+this.mainContainerId).hide();
	  //reset fq and remove fq in query of facetSearch and AutoCompleteManager
	  this.fq = '';
	  FacetSearch.store.remove('fq');
	  AutoCompleteManager.store.remove('fq');
	  $('.search_left').css({height: ""});
	  $('.search_right').css({height: ""});
    },

    //get search result when clicking on facets in the right side of drop-down list
    facetSearch: function(fq, opt){
    	var q;
    	if(jQuery.inArray(this.q,this.incorrectkeywords) > -1){
    		q = this.didyoumeantext;
    	}else q = this.currentValue;
    	if(this.fq.length == 0 && opt == 0)
    		return true;

    	if(this.fq.length == 0){
    		this.fq = fq;
    	}else{
    		if(opt == 0){//subtract facet
    			var tmp = this.fq.split(" OR ");
    			var nq = '';
    			for(i=0;i<tmp.length;i++){
    				if(tmp[i] != fq){
    					if(nq.length == 0)
    						nq = tmp[i];
    					else nq += ' OR ' + tmp[i];
    				}
    			}
    			this.fq = nq;
    		}else{//add facet
    			this.fq += ' OR ' + fq;
    		}
    		FacetSearch.store.remove('fq');
    	}
    	if(!this.isBadQuery(q)){
    		FacetSearch.store.addByValue('q', 'autosuggest:' +q);
    		FacetSearch.store.addByValue('json.nl', 'map');
    		FacetSearch.store.addByValue('rows', '50');
    		FacetSearch.store.addByValue('fl', 'autosuggest,name,products_image,products_id');
    		FacetSearch.store.addByValue('timestamp', new Date());

    		FacetSearch.store.addByValue('fq', this.fq);
    		FacetSearch.doRequest();
    	}
    },
	/**
	* suggest is the function which is invoked in the onValueChange function to process and display suggestions
	*/
    suggest: function() {
		//Hide the suggestion board if search box value is empty.
		if(this.el.val().length < 1){
			this.hide();
			return;
		}
		if (this.suggestions.length === 0 && this.spellsuggestions.length === 0) {
			this.hide();
			return;
		}else $('#' + this.mainContainerId).show();

		var me, len, div, f, v, i, s, mOver, mClick;
		me = this;
		len = this.suggestions.length;
		f = this.options.fnFormatResult;
		v = this.getQuery(this.currentValue);
		// Get the keyword which is used to search for products so that we can highlight keyword in the product name
		var arrs = AutoCompleteManager.response.responseHeader.params.q.split("autosuggest:");
		v = arrs[1];
		mOver = function(xi) { return function() { me.activate(xi); }; };
		mClick = function(xi) { return function() { me.select(xi); }; };
		this.container.hide().empty();

		$('.search_left').css({height: ""});

		//The for loop to add product name to suggestion board (suggestion container)
		for (i = 0; i < len; i++) {
			s = this.suggestions[i];
			div = $((me.selectedIndex === i ? '<div class="search_line selected"' : '<div class="search_line"') + ' title="' + s + '">' + f(s, v) + '</div>');
			div.mouseover(mOver(i));
			div.click(mClick(i));
			this.container.append(div);
		}

		this.catContainer.hide().empty();
		$('.search_right').css({height: ""});
		catContainer = this.catContainer;
		//Set up the close button on the top right hand
		var closebtn = $('<div id="close_button" class="suggest_close_button"></div>');
		closebtn.bind('click', function(){
			me.hide();
		});
		//Display or hide the "Did you mean" text
		if(jQuery.inArray(this.q,this.incorrectkeywords) > -1){
			$('#didyoumean').show();
			$('#didyoumean_text').text(this.didyoumeantext);
			if($('#didyoumean').find('#close_button').length == 0){
				closebtn.css({'position':'absolute','top':'0px','left':'610px'});
				closebtn.appendTo($('#didyoumean'));
			}
		}else{
			$('#didyoumean').hide();
			this.didyoumeantext = '';
			closebtn.appendTo(catContainer);
		}

		//display categories list on the right side
		var cat = $('<div class="search_category"></div>');
		var catLbl = $('<label class="right_label"></label>');
		var catList = $('<ul></ul>');
		var ctotal = 0;
		var o_fq = [];
		if(this.fq.length > 0){
			o_fq = this.fq.split(' OR ');
		}
	  $.each(AutoCompleteManager.response.facet_counts.facet_fields.category, function (key,val){
		if(val > 0){
			li = $('<li onmouseover="$(this).addClass(\'selected\');" onmouseout="$(this).removeClass(\'selected\');" title="'+key+'" style="cursor:pointer;" >- <span >'+key+'</span></li>');
			if(o_fq.length > 0){
				var fq = 'category:"'+key+'"';
				if($.inArray(fq, o_fq) > -1){
					li.children().addClass('active');
				}
			}
			li.bind('click', function(){
				if(me.facets){
					var span = $(this).children();
					var opt = 1;//default opt = 1 in case add facet
					var fq = 'category:"'+key+ '"';
					if(span.hasClass('active')){
						span.removeClass('active');
						opt = 0;//opt = 0 in case subtract facet
					}else{
						span.addClass('active');
					}
					storeSession(key, 0, opt);
					me.facetSearch(fq, opt);
				}else{
					redirect(result_link+'?&keywords='+$('#searchterm').val()+'&cname='+key);
				}
			});
			catList.append(li);
			ctotal += val;
		}
	  });
	  if(ctotal > 0){
		  catLbl.html(lbl_category);
		  catLbl.appendTo(cat);
		  catList.appendTo(cat);
		  cat.appendTo(catContainer);
	  }

	  //display manufacturers list on the right side
	  var manf = $('<div class="search_category"></div>');
	  var manfLbl = $('<label class="right_label"></label>');
	  var manfList = $('<ul></ul>');
	  var mtotal = 0;
	  $.each(AutoCompleteManager.response.facet_counts.facet_fields.manufacturers_name, function(key,val){
		if(val > 0){
		  	li = $('<li onmouseover="$(this).addClass(\'selected\');" onmouseout="$(this).removeClass(\'selected\');" title="'+key+'" style="cursor:pointer;">- <span >'+key+'</span></li>');
		  	if(o_fq.length > 0){
				var fq = 'manufacturers_name:"'+key+'"';
				if($.inArray(fq, o_fq) > -1){//this category was selected
					li.children().addClass('active');
				}
			}
		  	li.bind('click', function(){
		  		if(me.facets){
		  			var span = $(this).children();
		  			var opt = 1;//default opt = 1 in case add facet
		  			var fq = 'manufacturers_name:"' +key+ '"';
		  			if(span.hasClass('active')){
		  				span.removeClass('active');
		  				opt = 0; //opt = 0 in case subtract facet
		  			}else{
		  				span.addClass('active');
		  			}
		  			storeSession(key, 1, opt);
		  			me.facetSearch(fq, opt);
		  		}else{
		  			redirect(result_link+'?&keywords='+$('#searchterm').val()+'&manf='+key);
		  		}
		  	});
		  	manfList.append(li);
		  	mtotal += val;
		}
	  });
	  if(mtotal > 0){
		  manfLbl.html(lbl_manufacturer);
		  manfLbl.appendTo(manf);
		  manfList.appendTo(manf);
		  manf.appendTo(catContainer);
	  }

	  //add picture at the bottom of drop-down box
	  var bot = $('.search_bottom');
	  var div = '';
	  for(i=0; i < Math.min(5,this.pimages.length); i++){
	  	div += '<div class="search_product_saleoff" onclick="redirect(\''+result_link+'?products_id='+this.pids[i]+'\');" style="cursor:pointer;"><div class="picture"><img src="'+dir_thumb_images+this.pimages[i]+'" onerror="this.src=\''+dir_thumb_images+'noimage.gif\'" alt="'+this.suggestions[i]+'" width="80px" height="80px" /></div></div>';
	  }
	  bot.empty();
	  bot.append(div);
	  $('#'+this.mainContainerId).append(bot);

      this.enabled = true;
	  this.catContainer.show();
      this.container.show();
	  synheight($('.search_left'), $('.search_right'));
    },
	/**
	* processResponse is the function will be invoked when ajax request finished
	* The function process json output from Solr and then call the suggest() function to display suggestion
	*/
    processResponse: function(response) {
		var autoc = this;
		//this.suggestions = response.suggestions;
		autoc.cachedResponse = [];
		autoc.suggestions = [];
		autoc.pimages = [];
		autoc.pids = [];
		autoc.spellsuggestions = [];
		var index = 1;
		$.each(response.response.docs,function(key, value){
			if(jQuery.inArray(value.autosuggest,autoc.suggestions) < 0){
				autoc.suggestions.push(value.autosuggest);
				autoc.pimages.push(value.products_image);
				autoc.pids.push(value.products_id);
			}
			index++;
			if(autoc.suggestions.length >= 15){
				return false;
			}
		})
		//Push suggested products in case user type incorrect keywords
		if(typeof response.spellcheck !== 'undefined' && typeof response.numFound !== 'undefined' && response.numFound < 1){
		  var keywords = autoc.q;
		  $.each(response.spellcheck.suggestions,function(key, value){
			keywords = keywords.replace(key, value.suggestion[0])
		  })
		  if(jQuery.inArray($.trim(keywords),autoc.spellsuggestions) < 0 && keywords !== autoc.q){
			autoc.spellsuggestions.push(keywords);
		  }
		}
		//Invoked suggest() function to display the suggestion container
		autoc.suggest();
    },

    //change color when mouse over
    activate: function(index) {
      var divs, activeItem;
      divs = this.container.children();
      // Clear previous selection:
      if (this.selectedIndex !== -1 && divs.length > this.selectedIndex) {
        $(divs.get(this.selectedIndex)).removeClass('selected');
      }
      this.selectedIndex = index;
      if (this.selectedIndex !== -1 && divs.length > this.selectedIndex) {
        activeItem = divs.get(this.selectedIndex);
        $(activeItem).addClass('selected');
      }
      return activeItem;
    },

    deactivate: function(div, index) {
      div.className = '';
      if (this.selectedIndex === index) { this.selectedIndex = -1; }
    },

    //process when select by mouse on list name of item
    select: function(i) {
      var selectedValue, f;
      selectedValue = this.suggestions[i];
      if (selectedValue) {
        this.el.val('name_exact:"'+selectedValue+'"');
        if (this.options.autoSubmit) {
          f = this.el.parents('form');
          if (f.length > 0) { f.get(0).submit(); }
        }
        this.ignoreValueChange = true;
        $('#didyoumean').hide();
        this.hide();
        this.onSelect(i);
      }
    },

    moveUp: function() {
      if (this.selectedIndex === -1) { return; }
      if (this.selectedIndex === 0) {
        this.container.children().get(0).className = 'search_line';
        this.selectedIndex = -1;
        this.el.val(this.currentValue);
        return;
      }
      this.adjustScroll(this.selectedIndex - 1);
    },

    moveDown: function() {
      if (this.selectedIndex === (this.suggestions.length - 1)) {
      	return;
      }
      this.adjustScroll(this.selectedIndex + 1);
    },

    adjustScroll: function(i) {
      var activeItem, offsetTop, upperBound, lowerBound;
      activeItem = this.activate(i);
      offsetTop = activeItem.offsetTop;
      upperBound = this.container.scrollTop();
      lowerBound = upperBound + this.options.maxHeight - 25;
      if (offsetTop < upperBound) {
        this.container.scrollTop(offsetTop);
      } else if (offsetTop > lowerBound) {
        this.container.scrollTop(offsetTop - this.options.maxHeight + 25);
      }
      this.el.val(this.getValue(this.suggestions[i]));
    },

    onSelect: function(i) {
      var me, fn, s, d;
      me = this;
      fn = me.options.onSelect;
      s = me.suggestions[i];
      d = me.data[i];
      me.el.val(me.getValue(s));
      if ($.isFunction(fn)) { fn(s, d, me.el); }
    },

    getValue: function(value){
        var del, currVal, arr, me;
        me = this;
        del = me.options.delimiter;
        if (!del) { return value; }
        currVal = me.currentValue;
        arr = currVal.split(del);
        if (arr.length === 1) { return value; }
        return currVal.substr(0, currVal.length - arr[arr.length - 1].length) + value;
    }

  };

}(jQuery));

//jquery plugin for equal height of all column
(function($) {
	$.fn.equalHeights = function(minHeight, maxHeight) {
		tallest = (minHeight) ? minHeight : 0;
		this.each(function() {
			if($(this).height() > tallest) {
				tallest = $(this).height();
			}
		});
		if((maxHeight) && tallest > maxHeight) tallest = maxHeight;
		return this.each(function() {
			$(this).height(tallest).css("overflow","auto");
		});
	}
})(jQuery);
