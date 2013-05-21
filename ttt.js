var fs = require('fs'),
    http = require('http');


// This commented bit is enough to get a working app, if used in conjunction with a webserver to serve the static files. Used the workaround below to get a working demo on node.js only. 
// var serv = http.createServer(function(req, res) {
//                 res.writeHead(200, { 'Content-type': 'text/html'});
//                 res.end(fs.readFileSync(__dirname + '/public/ttt.html'));}).listen(8080, function() { console.log('running 8080');});


//use of a fs and node-static to serve the static files to client

function handler(request, response) {
    "use strict";
    fileServer.serve(request, response); // this will return the correct file
}

var app = http.createServer(handler),
    iosocks = require('socket.io').listen(app),
    staticserv = require('node-static'), // for serving files

    // This will make all the files in the current folder
    // accessible from the web
    fileServer = new staticserv.Server('./');
app.listen(8080);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///Game definition////
var game = (function() {
    var mv = 0,
        p = [],
        queue = [],
        lastmove = '',
        board = [0, 0, 0, 0, 0, 0, 0, 0, 0];


    ////////User handling////////
    var addtoQueue = function(player) {
        queue.push(player);
        console.log('added to queue : ' + player.name);
    },
    addPlayer = function(player) {
        player.score = 0;
        p.push(player);
        console.log('player added: ' + player.name);
        return p;
    },
    getPlayers = function() {
        return p.length;
    },
    updateQueue = function() {
        if (queue.length) {
            addPlayer(queue[0]);
            queue.splice(0, 1);
            console.log('queue updated ' + queue.length);
        }
    },
    getRow = function(x) {
        var row = Number((x / 200).toString().charAt(0), null);
        return row;
    },
    isLegal = function(move) {
        if (lastmove === '' || lastmove !== move.color && board[move.box] === 0) {
            return true;
        } else {
            return false;
        }
    },
    testWin = function() {

        //winning combinations 
        var win = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        //check board for a winner 
        for (var i=0; i < 8; i += 1) {
            if (board[win[i][0]] === board[win[i][1]] && board[win[i][0]] === board[win[i][2]] && board[win[i][0]] !== 0) {
                return true;
            }
        }
        return false;
    },
    resetBoard = function() {
        board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
        mv = 0;
        lastmove = '';
    };

    ////////public members////////
    return {
        sortPlayers: function(user) {
            if (getPlayers() < 2) {
                var players = addPlayer(user);
                console.log({
                    name: players[0].name,
                    color: players[0].color
                });

                if (getPlayers() === 2) {
                    players[1].id.emit('addPlayer', {
                        name: players[1].name,
                        color: 'x'
                    });
                    players[1].id.emit('addPlayer', {
                        name: players[0].name,
                        color: 'o'
                    });
                    players[0].id.emit('addPlayer', {
                        name: players[1].name,
                        color: 'x'
                    });
                    players[0].id.emit('addPlayer', {
                        name: players[0].name,
                        color: 'o'
                    });
                    players[0].id.emit('startGame', 'o');
                    players[1].id.emit('startGame', 'x');
                }
            } else {
                addtoQueue(user);
            }
        },
        splicePlayer: function(user) {
            for (var i = 0, j = getPlayers(); i < j; i += 1) {
                if (user.name === p[i].name) {
                    p.splice(i, 1);
                    updateQueue();
                    return;
                }
            }
        },
        tryMove: function(m) {
            var row = getRow(m.y),
                col = getRow(m.x),
                boxmove = 3 * row + col,
                move = {
                    color: m.color,
                    box: boxmove
                };
            if (isLegal(move)) {
                board[boxmove] = move.color;
                move.y = 200 * row + 100;
                move.x = 200 * col + 100;
                p[1].id.emit('move', move);
                p[0].id.emit('move', move);

                //update lastmove and movecounter
                lastmove = move.color;
                mv += 1;
                if (testWin()) {

                    if (lastmove === 'o') {
                        p[0].id.emit('endGame', 1);
                        p[1].id.emit('endGame', 0);
                    } else {
                        p[1].id.emit('endGame', 1);
                        p[0].id.emit('endGame', 0);
                    }
                    resetBoard();
                    //We got a winner, reset board!

                } else if (mv === 9) {
                    p[1].id.emit('endGame', 2);
                    p[0].id.emit('endGame', 2);
                    resetBoard();
                }
            } else {
                p[1].id.emit('error', move);
                p[0].id.emit('error', move);
            }

        }

    };

}());

/////Handling global users
var users = [];

var addUser = function(name, id) {
    var user = {
        name: name,
        id: id
    };
    users.push(user);
    return user;
};
var spliceUser = function(user) {
    for (var i = 0; i < users.length; i += 1) {
        if (user.name === users[i].name) {
            users.splice(i, 1);
            return;
        }
    }
};


/////////////SOCKET EVENTS//////////////
iosocks.on('connection', function(soc) {
    "use strict";
    var user = {};

    soc.on('disconnect', function() {
        spliceUser(user);
        game.splicePlayer(user);
    });

    soc.on('addUser', function(name) {
        user = addUser(name, soc);
        soc.broadcast.emit('newUser', '<b>' + user.name + '</b> has connected </br>');
        game.sortPlayers(user);
    });
    soc.on('tryMove', function(c, x, y) {
        game.tryMove(c, x, y);
    });
    soc.on('chatmsg', function(msg) {
        console.log(msg);
        soc.broadcast.emit('chatmsg', msg);
    });

});