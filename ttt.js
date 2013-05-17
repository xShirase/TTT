var fs = require('fs'),
    http = require('http'),
    mv = 0,
    p = [],
    lastmove = '',
    board = [0, 0, 0, 0, 0, 0, 0, 0, 0];

//Game Functions

function testwin(board) {
    "use strict";
    var i = 0,
        //winning combinations 
        win = [
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
    for (i; i < 8; i += 1) {
        if (board[win[i][0]] === board[win[i][1]] && board[win[i][0]] === board[win[i][2]] && board[win[i][0]] !== 0) {
            return 1;
        }
    }
    return -1;
}

function getRow(x) {
    "use strict";
    var row = parseInt((x / 200).toString().charAt(0), null);
    return row;
}


// This commented bit is enough to get a working app, if used in conjunction with a webserver to serve the static files (best practice). Used the workaround below to get a working demo on node.js only. 
// var serv = http.createServer(function(req, res) {
//                 res.writeHead(200, { 'Content-type': 'text/html'});
//                 res.end(fs.readFileSync(__dirname + '/public/ttt.html'));}).listen(8080, function() { console.log('running 8080');});


// var iosoc = require('socket.io'); 
// var iosocks = iosoc.listen(connect);


//use of a fs and node-static to serve the static files to client

function handler(request, response) {
    "use strict";
   /* response.writeHead(200, {
                         'Access-Control-Allow-Origin' : '*',
                         'Access-Control-Allow-Headers': 'x-requested-with'});*/
    fileServer.serve(request, response); // this will return the correct file
}

var app = http.createServer(handler),
    iosocks = require('socket.io').listen(app),
    staticserv = require('node-static'); // for serving files

// This will make all the files in the current folder
// accessible from the web
var fileServer = new staticserv.Server('./');
app.listen(8080);


//when a client connects :
iosocks.on('connection', function(soc) {
    "use strict";
    //on disconnect
    soc.on('disconnect', function() {
        var i = 0,
            c = 0,
            len = 0;
        for (i, len = p.length; i < len; i += 1) {
            c = p[i];
            if (c.id === soc) {
                console.log('player deleted');
                p.splice(i, 1);
                if(p.length){p[0].id.emit('message', 'win,Opponent forfeited. Congratulations!');}
                board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                mv = 0;
                lastmove = '';
                break;
            }
        }
    });

    //listen for 'message' signal
    soc.on('message', function(message) {
        console.log('Message Received: ', message);

        //all the part below is game specific. The message is parsed to give the required infos (assign player colors, moves, etc)
        var msg = message.split(','),
            color = '',
            player = {},
            i = 0,
            c = 0,
            len = 0,
            xcol = 0,
            yrow = 0,
            col = 0,
            row = 0,
            boxmove = 0;

        if (msg[0] === 'player') {
            if (p.length < 2) {
                //log in new player, record its socket and assign a color (X or O)
                player.id = soc;

                if (p[0]) {
                    if (p[0].color === 'x') {
                        player.color = 'o';
                    } else if (p[0].color === 'o') {
                        player.color = 'x';
                    }
                } else {
                    player.color = 'x';
                }
                console.log('NEW PLAYER');

                p.push(player);
                soc.emit('message', 'player,' + p.length + ',' + player.id + ',' + player.color);

                if (p.length === 2) {
                    //2 players have logged in, sending a 'start' message to clients and clearing the board
                    console.log('2pl');
                    p[0].id.emit('message', 'start,' + p[0].color);
                    p[1].id.emit('message', 'start,' + p[1].color);
                    board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                }

            } else {
                soc.emit('error', 'board full, try later');
            }

        } else if (p.length === 2) {
            // client has made a move
            if (msg[0] === 'move') {

                if (mv < 9) { // a game can't have more than 9 consecutive moves. 
                    //retrieve color for the player who emitted the move
                    for (i, len = p.length; i < len; i += 1) {
                        c = p[i];
                        if (c.id === soc) {
                            color = c.color;
                            break;
                        }
                    }

                    //Check if move legal
                    if (lastmove === '' || lastmove !== color) { //if it's the right client's turn or first move of the game

                        //reading clicked coordinates and converting them to a box of coordinate (row,col) example, top left box is (0,0), then to number 0..8 (top left = 0, bottom right = 8)

                        row = getRow(msg[3]);
                        col = getRow(msg[2]);
                        boxmove = 3 * row + col;

                        if (board[boxmove] === 0) { //if box is empty

                            if (color === 'x') {
                                board[boxmove] = 1;
                            } else {
                                board[boxmove] = 2;
                            }

                            //send coordinates of center of box to the player, so client knows what and where to draw
                            //syntax of move :   move,color,x,y

                            yrow = 200 * row + 100;
                            xcol = 200 * col + 100;
                            p[1].id.emit('message', 'move,' + color + ',' + xcol + ',' + yrow);
                            p[0].id.emit('message', 'move,' + color + ',' + xcol + ',' + yrow);

                            //update lastmove and movecounter
                            lastmove = color;
                            mv += 1;

                            //test board for a winner
                            if (testwin(board) === 1) {
                                if (i === 0) {
                                    p[0].id.emit('message', 'win,you win !');
                                    p[1].id.emit('message', 'win,you suck... get lost !');
                                } else {
                                    p[1].id.emit('message', 'win,you win !');
                                    p[0].id.emit('message', 'win,you suck... get lost !');
                                }

                                //We got a winner, reset board!
                                board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                                mv = 0;
                                lastmove = '';
                            } else if (mv === 9) {
                                p[1].id.emit('message', 'win,It\'s a tie!');
                                p[0].id.emit('message', 'win,It\'s a tie!');
                                board = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                                mv = 0;
                                lastmove = '';
                            }

                        } else {
                            p[i].id.emit('message', 'error,box full... Dumbass.');
                        }
                    } else {
                        p[i].id.emit('message', 'error,Not your turn, dumbass.');
                    }

                }
            }
        } else if (msg[0] === 'move') {
            p[0].id.emit('message', 'alert,Waiting for an opponent');
        } else {
            soc.broadcast.emit('message', msg);
        } //stays here for further functionalities

    });
});