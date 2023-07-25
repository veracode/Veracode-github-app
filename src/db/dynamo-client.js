const AWS = require('aws-sdk')
const DataMapper = require('@aws/dynamodb-data-mapper').DataMapper
require('dotenv').config();

let config = {}
if (process.env.NODE_ENV === 'development') {
  config.region = process.env.DB_REGION
  config.endpoint = process.env.DB_ENDPOINT
  config.accessKey = process.env.DB_ACCESSKEY
  config.secretAccessKey = process.env.DB_SECRETACCESSKEY
} else {
  config.region = process.env.DB_REGION
  config.accessKey = ''
  config.secretAccessKey = ''
}

const client = new AWS.DynamoDB(config)
const mapper = new DataMapper({ client })

module.exports = mapper