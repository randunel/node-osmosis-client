'use strict';

var fs = require('fs');
var path = require('path');
var http = require('http');
var net = require('net');
var exec = require('child_process').exec;

var request = require('request');
var Connection = require('ssh2');
var argv = require('minimist')(process.argv.slice(2));

var server = 'localhost';
var url = 'http://' + server + ':8000';
// var key = path.join(process.env.HOME, '.ssh', 'id_rsa.pub');
var dir = path.join(__dirname, 'config');
var key = path.join(dir, 'id_rsa');

var localAddress = 'localhost';
var localPort = '3007';

exec('rm -r ' + dir, function() {
    fs.mkdir(dir, function(err) {
        if (err) {
            throw err;
        }
        exec('ssh-keygen -N "" -t rsa -f ' + key, function(err) {
            if (err) {
                throw err;
            }
            fs.readFile(key + '.pub', function(err, key) {
                if (err) {
                    throw err;
                }
                var req = request({
                    url: url + '/users',
                    method: 'POST',
                    json: {
                        key: key.toString()
                    }
                }, function(err, res, body) {
                    if (err) {
                        console.error('Could not send public key, check connection to osmosis-server');
                        throw err;
                    }
                    if (body.result !== 'success') {
                        console.error('Unexpected server response', body);
                        throw new Error('Unexpected server response');
                    }
                    establishConnection(body.port, key);
                });
            });
        });
    });
});

function establishConnection(remotePort, key) {
    var ssh = new Connection();
    ssh.on('tcp connection', function(info, accept, reject) {
        var stream = accept();
        stream.pause();

        var socket = net.connect(localPort, localAddress, function() {
            stream.pipe(socket);
            socket.pipe(stream);
            stream.resume();
        });
        socket.on('error', function(err) {
            console.warn(err);
            if ('ECONNREFUSED' === err.code) {
                console.log('Connection refused on ' + localAddress + ':' + localPort);
            }
        });
    });
    ssh.on('ready', function() {
        console.log('ssh connection ready');
        setTimeout(function() {
            ssh.forwardIn(server, remotePort, function(err) {
                if (err) {
                    throw err;
                }
                console.log('forwarding from ' + server + ':' + remotePort);
            });
        }, 1000);
    });
    ssh.on('error', function(err) {
        console.error('ssh connection error', err);
        throw err;
    });
    ssh.on('end', function() {
        console.log('ssh connection end');
    });
    ssh.on('close', function(byError) {
        console.log('ssh connection close', byError);
    });
    ssh.connect({
        host: server,
        port: 44044,
        username: 'osmosis_ssh',
        // privateKey: fs.readFileSync(path.join(process.env.HOME, '.ssh', 'id_rsa')),
        privateKey: fs.readFileSync(path.join(dir, 'id_rsa'))
    });
}

