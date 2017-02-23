

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var routes = require('./routes/index');


var app = express();


var Marketcloud = require('marketcloud-node');

if ('undefined' === typeof process.env.MARKETCLOUD_PUBLIC_KEY ||
    'undefined' === typeof process.env.MARKETCLOUD_SECRET_KEY) {
    throw new Error("Unable to find keys in ENV. Please set MARKETCLOUD_PUBLIC_KEY and MARKETCLOUD_SECRET_KEY in your environment.");
}

var mc = new Marketcloud.Client({
    public_key : process.env.MARKETCLOUD_PUBLIC_KEY,
    secret_key : process.env.MARKETCLOUD_SECRET_KEY
});

app.locals.MARKETCLOUD_PUBLIC_KEY = process.env.MARKETCLOUD_PUBLIC_KEY;

app.set('marketcloud',mc);


app.use(function(req,res,next){
    if (app.locals.config){
        return next();
    }

    return mc.application.get()
    .then(function(response){
        app.locals.config = response.data[0];
        next();
        return null;
    })
    .catch(function(error){
        console.log("Unable to load app settings");
        next();
        return null;
    })


})



// view engine setup

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');




/**********************************
        SESSION CONFIG
***********************************/



app.use(session({
    cookie : {maxAge : 24*3600*1000*30},
    ttl : 24 * 60 * 60 , //1 day
    name : '_mc_frontend_sessid',
    secret: 'oasijdi0jw80dj1nc1hf18u9820310d1dj08810948n184d198s1131dk1di',
    saveUninitialized : true,    
    resave:false
}));



var env = process.env.NODE_ENV || 'development';
app.locals.ENV = env;
app.locals.ENV_DEVELOPMENT = env == 'development';

// app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public/')));


app.use(function(req,res,next){
    if (req.session.user) {
        res.locals.user = req.session.user;
    }
    next();
})



app.use(function(req,res,next){


    var getCartPromise = function(){
        if (req.session.hasOwnProperty('cart_id')){
            return req.app.get('marketcloud').carts.getById(req.session.cart_id)
        }
        else{
            return req.app.get('marketcloud').carts.create()
        }
    }

    return getCartPromise()
    .then(function(response){
        res.locals.cart = response.data;
        req.session.cart_id = response.data.id
        next();
        return null;
    })  
    .catch(function(response){

        console.log("Unable to create or retrieve a cart.")
        next(response)
        return null;
    })
    
})


app.use(function(req,res,next){
    return mc.categories.list({})
    .then(function(response){
        res.locals.categories = response.data;
        next()
        return null;
    })
    .catch(function(response){
        // We keep goin
        res.locals.categories = [];
        next(response);
        return null;
    })
})

function requireAuthentication(req,res,next){
    if (req.session.user)
        next();
    else
        res.redirect('/login')
}


app.use('/', routes);
app.use('/user', requireAuthentication,require('./routes/user.route.js'));


/// catch 404 and forward to error handler
app.use(function(req, res, next) {
    res.render("404");
});

/// error handlers

// development error handler
// will print stacktrace

if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        console.log(err.stack)
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err,
            title: 'error'
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    console.log(err.stack)
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {},
        title: 'error'
    });
});


module.exports = app;
