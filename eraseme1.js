'use strict';
/*jshint unused:false, eqnull:true, laxcomma:true, laxbreak:true, debug:true, asi:true, browser:true, devel: true, node: true, es6: true*/
var tableSuffix
var theCb
var theSetupErrorCb
var isReady
const redis = require('redis')
const AWS = require('aws-sdk')
const fs = require('fs')
AWS.config.loadFromPath('config.json')
AWS.config.update({
   region: 'us-east-1',
   endpoint: 'https://dynamodb.us-east-1.amazonaws.com',
})
const client = redis.createClient({
   host: '172.31.28.226',
   port: 6379,
   password: 'e2c7dd14d6961',
})
isReady = false
const startT = (data) => {
   data.startTime = new Date()
}
const endT = (data) => {
   data.endTime = new Date()
   let timeDiff = data.endTime - data.startTime //in ms
   data.totalTime += timeDiff
   return timeDiff
}
const isRedisReady = () => {
   return isReady
}
client.on('ready', () => {
   isReady = true
   theCb()
})
client.on('error', (err) => {
   theSetupErrorCb(err)
})
const onReady = (cb) => {
   theCb = cb
}
const onSetupError = (cb) => {
   theSetupErrorCb = cb
}
process.on('exit', () => {
   client.quit()
})
const docClient = new AWS.DynamoDB.DocumentClient()
const dynDB = new AWS.DynamoDB()
const params = {
   TableName: 'userAndEmailList5',
}


const getRecords = (params) => {
   return new Promise((resolve, reject) => {
      docClient.scan(params, (err, data) => {
         if (err) {
            reject(err)
         } else {
            resolve(data)
         }
      })
   })
}

getRecords(params).then((data) => {
   console.log(data)
}).catch((err) => {
   console.error(err)
})

