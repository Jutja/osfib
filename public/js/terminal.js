    (function() {
    	window.onload = function() {
    		window.term = {};
    		window.editors = {};
    		window.primus = new Primus('http://localhost:8080', {
    			reconnect: {
    				max: Infinity // Number: The max delay before we try to reconnect.
    				,
    				min: 500 // Number: The minimum delay before we try reconnect.
    				,
    				retries: 10 // Number: How many times we shoult try to reconnect.
    			}
    		});
    		primus.on('data', function message(data) {
    			console.log(data);
    			var term = window.term;
    			switch (data.action) {
    				case "INIT_TERM":
    					{
    						if (data.ID >= 0) {
    							term[data.ID] = new Terminal({
    								cols: 80,
    								rows: 24,
    								useStyle: true,
    								screenKeys: true,
    								cursorBlink: false
    							});
    							term[data.ID].on('data', function(commands) {
    								primus.write({
    									'COMMAND_TERM': commands,
    									'ID': data.ID,
    									"action": "COMMAND_TERM"
    								});
    							});
    							terminalUiHandler(data.ID);
    						}
    					}
    					break;
    				case "COMMAND_TERM":
    					{
    						term[data.ID].write(data.COMMAND_TERM);
    					}
    					break;
    				case "TREE":
    					{
    						updatetree(data.tree);
    					}
    					break;
    				case "SUBTREE":
    					{
    						updateSubtree(data.tree, data.id, parseInt(data.level));
    					}
    					break;
    				case "OPENFILE":
    					{
    						updateEditor(data.data, data.id, data.path, data.name)
    					}
    					break;
    				case "SAVEFILE":
    					{
    						if (data.success) {
    							toastr.success(data.msg, 'Miracle Man Says')
    						} else {
    							toastr.error(data.msg, 'Error!')
    						}
    					}
    					break;
    				case "RESUME_TERM":
    					{
    						resumeTerm(data.terms);
    					}
    			}
    		});
    		primus.on('open', function message(data) {
    			console.log('connection started', data);
    			primus.write({
    				'action': 'BOOTSTRAP'
    			})
    		});
    	};
    }).call(this);

    function resumeTerm(terms) {
    	togglemodal("resume_modal", "show");
    	$('#modal_tnum').html(terms.length);
    }

    function termManage(value) {
    	primus.write({
    		'action': 'RESUME_TERM',
    		'value': value
    	});
    }

    function showtab(id) {
    	$('a[href="#' + id + '"]').tab('show');
    }


    function terminalUiHandler(id) {
    	var terminal = document.getElementById('term' + id);
    	if (terminal) { //terminal exists, needs focus though
    		// $('a[href="#term' + id + '"]').tab('show');
    		showtab('term' + id);
    		term[id].open(terminal);
    		term[id].write('\x1b[31mWelcome to terminus!\x1b[m\r\n');
    		window.primus.write({
    			"action": "INIT_TERM",
    			ID: id
    		});
    	} else { //terminal does not exist, create and give focus
    		$('#win2-parent').append('<li role="presentation" ><a href="#term' + id + '" aria-controls="home" role="tab" data-toggle="tab">' + id + '</a></li>');
    		$('#win2-childs').append('<div role="tabpanel" class="tab-pane" id="term' + id + '"></div>');
    		 $('#taskbar_terms').append('<li><a onclick=showtab("term'+id+'")>'+id+'</a></li>');

    		term[id].open(document.getElementById('term' + id));
    		term[id].write('\x1b[31mWelcome to terminus!\x1b[m\r\n');
    		window.primus.write({
    			"action": "INIT_TERM",
    			ID: id
    		});
    		showtab('term' + id);
    		// $('a[href="#term' + id + '"]').tab('show');
    		// $('#term'+id).tab();
    		togglemodal("resume_modal", "hide");
    		//update the taskbar todo
    	}
    }


    function updateEditor(data, id, path, name) {
    	var currenteditors = window.editors;
    	var uid = new Hashes.MD5().hex(path);
    	if (currenteditors.hasOwnProperty(uid) && document.getElementById('editor' + uid)) {
    		// $('#editor'+uid).tab('show');
    		// $('a[href="#editor' + uid + '"]').tab('show');
    		showtab('editor' + uid);
    		currenteditors[uid].setValue(data, -1);
    		//make the tab active and update the content
    	} else {
    		//make a new tab and make it active and update the content
    		// currenteditors[path] = data;
    		$('<li><a href="#editor' + uid + '" data-toggle="tab">' + name + '</a></li>').appendTo('#win1-parent');
    		// $('#editor-parent').append('<li role="presentation"><a href="#editor'+uid+'" aria-controls="home" role="tab" data-toggle="tab">'+path+'</a></li>');
    		$('#win1-childs').append('<div role="tabpanel" class="tab-pane full_height_tab" id="editor' + uid + '"></div>');
    		$('#taskbar_editors').append('<li><a onclick=showtab("editor'+uid+'")>'+name+'</a></li>');
    		// $('<div class="tab-pane" id="editor' + uid + '"></div>').appendTo('#win1-childs');

    		// make the new tab active
    		// $('#editor-parent a:last').tab('show');
    		// $('a[href="#editor' + uid + '"]').tab('show');
    		showtab('editor' + uid);

    		currenteditors[uid] = ace.edit("editor" + uid);
    		currenteditors[uid].setValue(data, -1);
    		var modelist = ace.require("ace/ext/modelist");
    		var mode = modelist.getModeForPath(name).mode;
    		currenteditors[uid].session.setMode(mode);
    		currenteditors[uid]['epath'] = path;
    		currenteditors[uid].commands.addCommand({
    			name: 'saveFile',
    			bindKey: {
    				win: 'Ctrl-S',
    				mac: 'Command-S',
    				sender: 'editor|cli'
    			},
    			exec: function(env, args, request) {
    				window.primus.write({
    					action: "SAVEFILE",
    					path: currenteditors[uid]['epath'],
    					data: currenteditors[uid].getSession().getValue()
    				})
    			}
    		});
    	}
    }

    function togglemodal(id, mode) {
    	if (mode) {
    		$("#" + id).modal(mode);
    	} else {
    		$("#" + id).modal('toggle');
    	}
    }

    function updatetree(tree) {
    	var str = '';
    	str += nodestring(tree.text, true, 0, 0, tree.path, 0, true);
    	localStorage.setItem('top', tree.text)
    	localStorage.setItem('bot_id', 0)
    	var dir = tree.dir;
    	var files = tree.files;
    	var bot_id = (parseInt(localStorage.bot_id) || 0) + 1;
    	for (var j = 0; j <= dir.length - 1; j++) {
    		str += nodestring(dir[j].text, true, j, 1, dir[j].path, bot_id);
    	};
    	for (var k = 0; k <= files.length - 1; k++) {
    		str += nodestring(files[k].text, false, k + j, 2, files[k].path, bot_id);
    	}
    	localStorage.setItem('bot_id', k + j)
    	document.getElementById('tree').innerHTML = str;
    }

    function updateSubtree(tree, id, level) {
    	var str = '';
    	var bot_id = (parseInt(localStorage.bot_id) || 0) + 1;
    	str += nodestring(tree.text, true, parseInt(id.substr(4)), level, tree.path, bot_id, false, true);
    	localStorage.setItem('top', tree.text)
    	var dir = tree.dir;
    	var files = tree.files;
    	var bot_id = (parseInt(localStorage.bot_id) || 0) + 1;
    	for (var j = 0; j <= dir.length - 1; j++) {
    		str += nodestring(dir[j].text, true, j, level + 1, dir[j].path, bot_id, false);
    	};
    	for (var k = 0; k <= files.length - 1; k++) {
    		str += nodestring(files[k].text, false, k + j, level + 2, files[k].path, bot_id);
    	}
    	localStorage.setItem('bot_id', k + j + bot_id);
    	document.getElementById(id).innerHTML = str;
    }
     //top - tells the directory is the top one, need only for sub folders
    function nodestring(name, folder, id, level, path, bot_id, top, open) {
    	var temp = '';
    	for (var i = level - 1; i >= 0; i--) {
    		temp += '<span class="indent"></span>';
    	};
    	if ((folder && top) || (folder && open)) {
    		temp += '<span class="icon glyphicon"></span><span class="icon node-icon glyphicon glyphicon-folder-open"></span>';
    	} else if (folder) {
    		temp += '<span class="icon glyphicon"></span><span class="icon node-icon glyphicon glyphicon-folder-close"></span>';
    	}
    	if (top) {
    		return '<span id="tree' + (id + bot_id) + '" data-path="' + path + '"><li class="list-group-item node-tree" style="color:undefined;background-color:undefined;" onclick=upFold("' + path + '")><span class="glyphicon glyphicon-level-up" aria-hidden="true"></span>..</li><li class="list-group-item node-tree" style="color:undefined;background-color:undefined;" onclick=openFold("tree' + (id + bot_id) + '","' + name + '","' + folder + '","' + path + '","' + level + '")>' + temp + name + '</li></span>';
    	} else if (!open && folder) {
    		return '<span id="tree' + (id + bot_id) + '" data-path="' + path + '"><li class="list-group-item node-tree" style="color:undefined;background-color:undefined;" onclick=openFold("tree' + (id + bot_id) + '","' + name + '","' + folder + '","' + path + '","' + level + '")>' + temp + name + '</li></span>';
    	} else if (open && folder) {
    		return '<span id="tree' + (id + bot_id) + '" data-path="' + path + '"><li class="list-group-item node-tree" style="color:undefined;background-color:undefined;" onclick=closeFold("tree' + id + '","tree' + bot_id + '","' + name + '","' + path + '","' + level + '")>' + temp + name + '</li></span>';
    	} else {
    		return '<span id="tree' + (id + bot_id) + '" data-path="' + path + '"><li class="list-group-item node-tree" style="color:undefined;background-color:undefined;" onclick=openFile("tree' + (id + bot_id) + '","' + name + '","' + folder + '","' + path + '","' + level + '")>' + temp + name + '</li></span>';
    	}
    }

    function openFile(id, name, folder, path, level) {
    	window.primus.write({
    		action: "OPENFILE",
    		id: id,
    		name: name,
    		path: path
    	})
    }
     //Go Up a Folder
    function upFold(path) {
    	window.primus.write({
    		action: "UPFOLD",
    		path: path
    	})
    }

    function closeFold(id, newid, name, path, level) {
    	var bot_id = (parseInt(localStorage.bot_id) || 0) + 1;
    	document.getElementById(id).innerHTML = nodestring(name, true, parseInt(newid.substr(4)), level, path, bot_id, false, false)
    }

    function openFold(id, name, folder, path, level) {
    	if (path == localStorage.top) {
    		window.primus.write({
    			action: "TREE",
    			id: id,
    			name: name,
    			folder: folder,
    			DIR: path
    		})
    	} else {
    		window.primus.write({
    			action: "SUBTREE",
    			id: id,
    			name: name,
    			folder: folder,
    			dir: path,
    			level: level
    		})
    	}
    }