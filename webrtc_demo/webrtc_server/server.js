'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var fs = require('fs');
var https = require('https');

var clientArray = new Array();
var socketArray = new Array();
var clientNum = 0;
var gClientNameCreate = 100;

var options = {
    key: fs.readFileSync('/home/yunjin/webrtc/cert.key'),
    cert: fs.readFileSync('/home/yunjin/webrtc/cert.crt'),
    //ca: fs.readFileSync('ssl/certs/domain.com.cabundle')
};

var fileServer = new(nodeStatic.Server)();
var app = https.createServer(options, function(req, res) {
  fileServer.serve(req, res);
}).listen(40444);
console.log("listen on 40444");
var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {
	console.log("new connectiong coming.....");
  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  function findSocketByName(userName){
	var i;
	for(i=0;i<clientNum;i++)
	{
		console.log("client["+i+"]:"+clientArray[i]);
		if (clientArray[i]==userName)
		{
			console.log("find user:"+clientArray[i]);
			return socketArray[i];
		}			
	}
	
	return null;
  }
  
  socket.on('message', function(localName, remoteName, message) {
    console.log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
	var socket = findSocketByName(remoteName);
	if (socket == null)
	{
		console.log("not find socket by "+remoteName);
		return;
	}
    socket.emit('message', localName, message);
  });

  socket.on('create or join', function(room) {
    console.log('Received request to create or join room ' + room);

    var numClients = io.sockets.sockets.length;
    console.log('Room ' + room + ' now has ' + numClients + ' client(s)');
numClients = clientNum;
    if (numClients === 1) {
      socket.join(room);
      console.log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 2) {
      console.log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });
 
  
  
	socket.on('register', 
		function(userName) {
			//console.log('Received request to register ' + userName);
			if (userName === '0')
			{
				userName = gClientNameCreate;
				gClientNameCreate++;
				console.log("create new client:"+userName);
			}

			//var numClients = io.sockets.sockets.length;
			//console.log('userName ' + userName + ' now has ' + numClients + ' client(s)');

			socket.join(userName);
			console.log('Client ID ' + socket.id + ' register userName ' + userName+ ' allClientNum:'+clientNum);
			socket.emit('registerOk', userName, socket.id);
			if (clientNum > 0) {
				var i;
				for(i=0;i<clientNum;i++)
				{
					socket.emit('newClient', clientArray[i]);
					console.log("send old :"+clientArray[i]);
				}

				socket.broadcast.emit('newClient', userName);
				console.log("broadcat new clint:"+userName);
			}

			clientArray[clientNum] = userName;
			socketArray[clientNum] = socket;
			clientNum++;
		}
	);
	
	
	socket.on('isOnline', function(userName) {
		console.log('request check '+ userName + ' isOnline status');
		var i, ret = 0;
		for(i=0;i<clientNum;i++)
		{
			console.log("client["+i+"]:"+clientArray[i]);
			if (clientArray[i]==userName)
			{
				ret = 1;
				console.log("find user:"+clientArray[i]);
				break;
			}			
		}
		console.log('send response '+ userName + ' online staus:'+ret);
		socket.emit('isOnline', userName, ret);
	});
  
  	socket.on('getAllClients', function(localName){
		console.log('received getAllClients request from:'+localName);

		var i, j=0,size = clientNum;
		var clientList='';
		for(i=0;i<size;i++)
		{		
			if (clientArray[i]!=localName)
			{
				clientList += ' '+clientArray[i];
			}			
		}
		
		socket.emit('returnAllClients', clientList);
	});
	
	socket.on('hungup', function(localName, remoteName){
		console.log('received hungup from:'+localName+' to '+remoteName);

		var i, size = clientNum;
		for(i=0;i<size;i++)
		{		
			if (clientArray[i]==remoteName)
			{
				console.log('send hungup to '+clientArray[i]);
				socketArray[i].emit('hungup', localName);
			}			
		}
		
		//dump_clients();
	});
  
  	socket.on('bye', function(localName, remoteName){
		console.log('received bye from:'+localName);

		var i, size = clientNum;
		for(i=0;i<size;i++)
		{		
			if (clientArray[i]!=localName)
			{
				console.log('send bye to '+clientArray[i]);
				socketArray[i].emit('bye', localName);
			}			
		}
		
		//dump_clients();
	});
	
	 function sendMsgToClients(clientId, msg){
		console.log(clientId+' send msg:'+msg+' to all clients...');

		var i, j=0,size = clientNum;
		for(i=0;i<size;i++)
		{		
			socketArray[j].emit('bye', clientId);		
		}
	};
	
	socket.on('disconnect', function(){
		console.log('A client disconnect');

		var i, j=0,size = clientNum;
		var clientId = '';
		for(i=0;i<size;i++)
		{		
			if (socketArray[i]===socket)
			{			
				console.log( 'client:'+clientArray[i]+' disconnected');
				clientId = clientArray[i];
				clientNum--;
			}
			else
			{
				clientArray[j] = clientArray[i];
				socketArray[j] = socketArray[i];
				j++;
			}			
		}		
		dump_clients();
		sendMsgToClients(clientId, 'bye');
	});
	
	function dump_clients(){
		var i;
		console.log( 'Current has '+clientNum+' online now');
		for (i=0; i<clientNum;i++)
			console.log( '	client:'+clientArray[i]+' is online');
	}
  

});
