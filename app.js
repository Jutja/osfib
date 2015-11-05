/**
 * Module dependencies.
 */
var express = require('express');
var compress = require('compression');
var logger = require('morgan');
var errorHandler = require('errorhandler');
var methodOverride = require('method-override');
var path = require('path');
var expressValidator = require('express-validator');
var connectAssets = require('connect-assets');
var fs = require('fs');

/**
 * Controllers (route handlers).
 */

var homeController = require('./controllers/home');


var tree = require('./tree');

/**
 * Create Express server.
 */
var app = express();
var Primus = require('primus'),
    pty = require('pty.js');

var primus = Primus.createServer({
    port: 8080,
    transformer: 'sockjs'
});
var buff = {};
var term = {};
primus.save(path.join(__dirname, 'public', 'js', 'primus.js'));
primus.on('connection', function(spark) {
        spark.on("data", function data(packet) {
                switch (packet.action) {
                    case "BOOTSTRAP":
                        {
                            var terms = Object.keys(term)
                            var termid = terms.length;
                            if (!termid) {
                                term[termid] = pty.fork(process.env.SHELL || 'sh', [], {
                                    name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color') ? 'xterm-256color' : 'xterm',
                                    cols: 80,
                                    rows: 24,
                                    cwd: process.env.HOME
                                });
                                spark.write({
                                    'action': 'INIT_TERM',
                                    'ID': termid
                                });
                            } else {
                                spark.write({
                                    'action': 'RESUME_TERM',
                                    'terms': terms
                                });
                            }
                            tree.tree(__dirname, function(err, result) {
                                spark.write({
                                    tree: result,
                                    action: "TREE"
                                });
                            });
                        }
                        break;
                    case "RESUME_TERM":
                        {
                            var terms = Object.keys(term)
                            var termid = terms.length;
                            var value = packet.value;
                            if (value) {
                                console.log(1, terms)
                                for (var i = 0; i < terms.length; i++) {

                                    spark.write({
                                        'action': 'INIT_TERM',
                                        'ID': parseInt(terms[i])
                                    });
                                };

                            } else {
                                console.log(2)
                                for (var i = terms.length - 1; i >= 0; i--) {
                                    term[i].write("exit \n");
                                };
                                term[termid] = pty.fork(process.env.SHELL || 'sh', [], {
                                    name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color') ? 'xterm-256color' : 'xterm',
                                    cols: 80,
                                    rows: 24,
                                    cwd: process.env.HOME
                                });
                                spark.write({
                                    'action': 'INIT_TERM',
                                    'ID': termid
                                });
                            }

                        }
                        break;
                    case "INIT_TERM":
                        {
                            if (term[packet.ID]) {
                                term[packet.ID].on('data', function(tdata) {
                                    return !spark ? buff[packet.ID] = (tdata) : spark.write({
                                        'action': 'COMMAND_TERM',
                                        'ID': packet.ID,
                                        'COMMAND_TERM': tdata
                                    });
                                });
                            } else {
                                term[packet.ID] = pty.fork(process.env.SHELL || 'sh', [], {
                                    name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color') ? 'xterm-256color' : 'xterm',
                                    cols: 80,
                                    rows: 24,
                                    cwd: process.env.HOME
                                });
                                term[packet.ID].on('data', function(tdata) {
                                    return !spark ? buff[packet.ID].push(tdata) : spark.write({
                                        'action': 'COMMAND_TERM',
                                        'ID': packet.ID,
                                        'COMMAND_TERM': tdata
                                    });
                                });
                                term[packet.ID].write(packet.COMMAND_TERM);
                                // term[termid]["lastactive"] = Date.now();
                            }
                        }
                        break;
                    case "COMMAND_TERM":
                        {
                            if (packet.COMMAND_TERM && term[packet.ID]) {
                                // term[termid]["lastactive"] = Date.now();
                                term[packet.ID].write(packet.COMMAND_TERM);
                            } else {
                                term[packet.ID] = pty.fork(process.env.SHELL || 'bash', [], {
                                    name: require('fs').existsSync('/usr/share/terminfo/x/xterm-256color') ? 'xterm-256color' : 'xterm',
                                    cols: 80,
                                    rows: 24,
                                    cwd: process.env.HOME
                                });
                                term[packet.ID].write(packet.COMMAND_TERM);
                                // term[termid]["lastactive"] = Date.now();
                            }
                        }
                        break;
                    case "TREE":
                        {
                            if (packet.dir) {
                                tree.tree(packet.dir, function(err, result) {
                                    spark.write({
                                        tree: result,
                                        action: "TREE"
                                    });
                                });
                            }
                        }
                        break;
                    case "UPFOLD":
                        {
                            if (packet.path) {
                                tree.tree(packet.path, function(err, result) {
                                    spark.write({
                                        tree: result,
                                        action: "TREE"
                                    });
                                }, true);
                            }
                        }
                        break;
                    case "SUBTREE":
                        {
                            if (packet.dir) {
                                tree.subtree(packet.dir, function(err, result) {
                                    spark.write({
                                        tree: result,
                                        action: "SUBTREE",
                                        id: packet.id,
                                        level: packet.level
                                    });
                                });
                            }
                        }
                        break;
                    case "OPENFILE":
                        {
                            if (packet.path) {
                                var s = fs.ReadStream(packet.path);
                                var Fdata = '';
                                var name = path.basename(packet.path)
                                s.on('data', function(d) {
                                    Fdata += d;
                                });
                                s.on('error', function(err) {
                                    console.log(err)
                                });
                                s.on('end', function() {
                                    primus.write({
                                        action: "OPENFILE",
                                        id: packet.id,
                                        path: packet.path,
                                        data: Fdata,
                                        name: name
                                    })
                                })
                            }
                        }
                        break;
                    case "SAVEFILE":
                        {
                            if (packet.path && packet.data) {
                                fs.writeFile(packet.path, packet.data, function(err) {
                                    if (err) {
                                        console.log(err);
                                        primus.write({
                                            action: "SAVEFILE",
                                            msg: err,
                                            success: false
                                        })
                                    } else {
                                        primus.write({
                                            action: "SAVEFILE",
                                            id: packet.id,
                                            msg: "Your File has been saved",
                                            success: true
                                        })
                                    }
                                });

                            }

                }
                break;

            }
        })
})


/**
 * Express configuration.
 */
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(compress());
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: 31557600000
}));

app.use(connectAssets({
    paths: [path.join(__dirname, 'public/css'), path.join(__dirname, 'public/js')]
}));
app.use(logger('dev'));
app.use(expressValidator());
app.use(methodOverride());



/**
 * Primary app routes.
 */

app.get('/', homeController.index);

app.get('*', function(req, res) {
    res.status(404);
    res.render('404');
});

/**
 * Error Handler.
 */
app.use(errorHandler());

/**
 * Start Express server.
 */
app.listen(app.get('port'), function() {
    console.log('Express server listening on port %d in %s mode', app.get('port'), app.get('env'));
});
module.exports = app;