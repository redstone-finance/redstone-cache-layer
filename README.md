# Express API for redstone cache layer

## Getting started

### Requirements
* Have docker installed
* Node.js >= 20
* AWS console access
### Installing dependencies

```bash
#install yarn npm packages
yarn install 
# Install mongo and other items via docker
docker-compose up 
```
Create .env file, by renaming the example
```.example.env -> .env```
Add additional auth token for influx in .env - `INFLUXDB_TOKEN`
Token can be obtained [here]( https://eu-west-1.console.aws.amazon.com/systems-manager/parameters/%252Fdev%252Finfluxdb%252Ftoken/description?region=eu-west-1&tab=Table#list_parameter_filters=Name:Contains:influx)

### To run locally
```bash
# Run local express server
yarn dev
```

### To run local mongoDB on MacOS
https://docs.mongodb.com/manual/tutorial/install-mongodb-on-os-x/
```bash
mongod --config /usr/local/etc/mongod.conf --fork
```
