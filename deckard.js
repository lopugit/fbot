var express = require('express')
var app = express()
url = require('url')
path = require('path')
step = require('step')
http = require('http')
https = require('https')
request = require('request-promise')
mongoose = require('mongoose')
Step = require('step')
Promise = require('bluebird')
app.set('view engine', 'pug')
app.locals.basedir = path.join(__dirname, 'views')
    // FB NODE Packages in order of version number

var post = require('./models/post')
var log = require('./models/logs')

mongoose.Promise = Promise
var db = mongoose.createConnection("mongodb://localhost:27017/deckard")
var conf = require('./conf/fbconf')

// FB.setAccessToken(conf.appId+"|"+conf.appSecret)

var posts = [];
var v = 0
length = 0
currentRequests = 0
currentEdgeRequests = 0
currentPostRequests = 0
totalRequests = 0
totalEdgeRequests = 0
totalPostRequests = 0
totalErrors = 0
edgeErrors = []
postErrors = []
errors = []
arbCount = 0
arbTotalCount = 0
uniqueCommenters = []

function getPostEdgeAndSave(vars) {
    var edge = vars.edge
    fbId = vars.fbId
    ourPostId = vars.ourPostId
    accessToken = vars.accessToken
    postModel = vars.postModel
    realm = vars.realm
    url = "https://graph.facebook.com/v2.8/" + fbId + "/" + edge + "?limit=600&access_token=" + accessToken
    if (logging) {
        console.log("requesting edge: ")
        console.log(edge);
        console.log("from fb post: ")
        console.log(fbId);
        console.log("with url %s", url)
    }
    if (minimalFeedback) {
        currentRequests += 1
        totalEdgeRequests += 1
        totalRequests += 1
        currentEdgeRequests += 1
        console.log("Number of total requests %s", totalRequests)
        console.log("Number of active requests %s", currentRequests)
    }
    request({
        method: 'GET',
        uri: url,
        gzip: true,
        timeout: 0,
        forever: true
            // ,
            // headers: {
            // 		connection: "close"
            // 	}
    }, function(error, response, body) {
        // body is the decompressed response body
        // // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
        if (minimalFeedback) {
            currentRequests -= 1
            currentEdgeRequests -= 1
        }
        if (error) {
            if (logging) {
                console.error("there was an error requesting the edge %s, here is the error: ", edge)
                console.error(error)
                totalErrors += 1
                totalEdgeErrors += 1
                errors.push(error)
                edgeErrors.push(error)
            }
            return
        } else if (body) {
            var json = JSON.parse(body)
            if (logging) {
                console.log("succesfully received edge %s from post %s", edge, fbId);
                console.log(json)
            }
            if (minimalFeedback) {
                console.log("Number of active requests %s", currentRequests)
                console.log("Number of post requests %s", totalPostRequests)
                console.log("Number of total requests %s", totalRequests)
            }
            // Check if there is any data to process
            if (json.data) {
                console.log("this is json.data when looking up edge: " + edge)
                console.log(json.data)
                if (json.data.length > 0) {
                    if (edge == "attachments") {
                        if (json.data.type == "photo") {
                            postModel.findOne({
                                _id: ourPostId
                            }).then((post, err) => {
                                if (err) {
                                    console.error("there was an err when trying to find a post while saving attachment that was a photo")
                                } else if (post) {
                                    console.log("this is json.data[0].media")
                                    console.log(json.data[0].media)
                                    post[edge].data.push(json.data[0].media)
                                    post.image = json.data[0].media.src
                                    post.save(function(err) {
                                        if (err !== null) {
                                            console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                            console.error(err)
                                            console.log("trying to save post again after error")
                                            post.save(function(err) {
                                                if (err) {
                                                    console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                                    console.error(err)
                                                }
                                            })

                                        }
                                    })
                                } else {
                                    console.error("we found no post when searching for id: " + ourPostId)

                                }
                            })

                        }
                        // If the attachment was not a photo we simply return, we will handle other attachments later :)
                        else {
                            return
                        }
                    }
                    // If edge was not attachments, simply save edge as the returned data
                    else {
                        console.log("now we look up the post with id: " + ourPostId)
                        postModel.findOne({
                            _id: ourPostId
                        }).then((post, err) => {
                            console.log("this is the returned or found post")
                            console.log(post)
                            if (err) {
                                console.error("there was an error when trying to find a post while saving abitrary attachment data")
                                console.error(err)
                            } else if (post) {
                                if (edge == "comments") {
                                    console.log("the edge we want is comments")
                                    if (json.data) {
                                        console.log("there was json.data and this is it this is json.data")
                                        console.log(json.data)
                                        Promise.map(json.data, comment => {
                                            console.log("this is the comment in json.data when mapping promises")
                                            console.log(comment)
                                            return postModel.findOne({
                                                "fbData.id": comment.id
                                            })
                                        }).then(commentDocs => {
                                            // console.log("this is all commentDocs")
                                            // console.log(commentDocs)
                                            if (commentDocs.length > 0) {
                                                pushComments({
                                                    i: 0,
                                                    commentDocs: commentDocs,
                                                    post: post,
                                                    json: json
                                                })
                                            }


                                        })
                                    } else {
                                        return
                                    }
                                } else {
                                    // console.log("this is the edge when it says cannot read the length of undefined")
                                    // console.log(edge)
                                    // console.log("and so this is post[edge].data")
                                    // console.log(post[edge].data)
                                    if (post[edge].data.length > 0) {
                                        post[edge].history.push({
                                            data: post[edge].data,
                                            date: Date.now()
                                        })
                                        post[edge].data = json.data
                                        post.save(err => {
                                            if (err) {
                                                console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                                console.error(err)
                                                console.log("trying to save post again after error")
                                                post.save(function(err) {
                                                    if (err) {
                                                        console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                                        console.error(err)
                                                    }
                                                })
                                            }
                                        })

                                    } else {
                                        post[edge].data = json.data
                                        post.save(function(err) {
                                            if (err) {
                                                console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                                console.error(err)
                                                console.log("trying to save post again after error")
                                                post.save(function(err) {
                                                    if (err) {
                                                        console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                                        console.error(err)
                                                    }
                                                })
                                            }
                                        })
                                    }

                                }
                            } else {
                                console.error("we found no post when searching for id: " + ourPostId)
                            }
                        })
                    }
                }
                // If there was no data returned
                else {
                    return
                }

            } else {
                return
            }
        }
    })
}

function pushComments(vars) {
    var i = vars.i
    post = vars.post
    commentDocs = vars.commentDocs
    max = commentDocs.length
    json = vars.json
    if (i >= max - 1) {
        return
    } else {
        if (commentDocs[i]) {
            if (commentDocs[i].fbData.message !== json.data[i].message) {
                commentDocs[i].history.push(commentDocs[i].fbData)
                commentDocs[i].fbData = json.data[i]
                commentDocs[i].save(err => {
                    if (err) {
                        console.error("there was an error saving the post that is really a comment")
                        console.error(err)
                        console.error("trying to save again")
                        commentDocs[i].save(err => {
                            if (err) {
                                console.error("there was an error saving the post that is really a comment")
                                console.error(err)
                            } else {
                                vars.i += 1
                                pushComments(vars)
                            }
                        })
                    } else {
                        console.log("successfully saved the commentDoc")
                        vars.i += 1
                        pushComments(vars)
                    }
                })
                console.log("this is i in the for loop of commentDocs.length")
                console.log(i)
                console.log("this is the indexOf search for the newCommentPost id in post.comments.data")
                console.log(post.comments.data.indexOf(commentDocs[i].fbData.id))
                console.log("and this is the id of the newComment")
                console.log(commentDocs[i].fbData.id)
                if (post.comments.data.indexOf(commentDocs[i].fbData.id) < 0) {
                    post.comments.data.push(commentDocs[i].fbData.id)
                    post.save(err => {
                        if (err) {
                            console.error("there was an error when trying to save the post to update comments")
                            console.error(err)
                            console.error("saving again")
                            post.save(err => {
                                if (err) {
                                    console.error("there was an error when trying to save the post to update comments")
                                    console.error(err)
                                } else {
                                    vars.i += 1
                                    pushComments(vars)
                                }
                            })
                        } else {
                            console.log("successfully saved the post with updated comments list")
                            console.log(post)
                            vars.i += 1
                            pushComments(vars)
                        }
                    })
                }
                for (edge in postEdges) {
                    getPostEdgeAndSave({
                        edge: postEdges[edge],
                        fbId: commentDocs[i].fbData.id,
                        ourPostId: commentDocs[i]._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                }
            } else {
                if (post.comments.data.indexOf(commentDocs[i].fbData.id) < 0) {
                    post.comments.data.push(commentDocs[i].fbData.id)
                    post.save(err => {
                        if (err) {
                            console.error("there was an error when trying to save the post to update comments")
                            console.error(err)
                            console.error("saving again")
                            post.save(err => {
                                if (err) {
                                    console.error("there was an error when trying to save the post to update comments")
                                    console.error(err)
                                } else {
                                    vars.i += 1
                                    pushComments(vars)
                                }
                            })
                        } else {
                            console.log("successfully saved the post with updated comments list")
                            console.log(post)
                            vars.i += 1
                            pushComments(vars)
                        }
                    })
                } else {
                    vars.i += 1
                    pushComments(vars)
                }
            }
        } else {
            // console.log("this is the json.data[comment] data when saving a newCommentPost")
            // console.log(json.data[comment])
            console.log("there was no post document for the looked up post, so we're saving a new one, it's really a comment")
            var newCommentPost = new postModel({
                    fbData: json.data[i],
                    realm: realm,
                    id: json.data[i].id,
                    lastUpdated: json.data[i].created_time
                })
                // console.log("this is the id of the new comment we're saving as a post: ")
                // console.log(newCommentPost.fbData.id)
            newCommentPost.save(err => {
                if (err) {
                    console.error("there was an error saving the newCommentPost with id: " + newCommentPost.fbData.id)
                    console.error(err)
                    newCommentPost.save(err => {
                        if (err) {
                            console.error("there was an error saving the newCommentPost with id: " + newCommentPost.fbData.id)
                            console.error(err)
                        } else {}
                    })
                } else {}
            })
            console.log("this is i in this forloop of all comments in the post but really it's the length of the results from looking up all id's of the comments on a post")
            console.log(i)
            console.log("this is the indexOf search for the newCommentPost id in post.comments.data")
            console.log(post.comments.data.indexOf(newCommentPost.fbData.id))
            console.log("and this is the id of the newComment")
            console.log(newCommentPost.fbData.id)
            if (post.comments.data.indexOf(newCommentPost.fbData.id) < 0) {
                console.log("this is the post we're inserting the comments into")
                console.log(post.fbData)
                console.log(post.comments)
                console.log("the id of the comment we want to add was not yet in the post comments list of ids")
                post.comments.data.push(newCommentPost.fbData.id)
                post.save(err => {
                    if (err) {
                        console.error("there was an error when trying to save the post to update comments")
                        console.error(err)
                        console.error("saving again")
                        post.save(err => {
                            if (err) {
                                console.error("there was an error when trying to save the post to update comments")
                                console.error(err)
                            } else {
                                console.log("we saved the post with comments pushed, here's the post: ")
                                console.log(post)
                                vars.i += 1
                                pushComments(vars)

                            }

                        })
                    } else {
                        console.log("we saved the post with comments pushed, here's the post: ")
                        console.log(post)
                        vars.i += 1
                        pushComments(vars)

                    }
                })
                for (edge in postEdges) {
                    getPostEdgeAndSave({
                        edge: postEdges[edge],
                        fbId: newCommentPost.fbData.id,
                        ourPostId: newCommentPost._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                }
            }
        }
    }
}

function recursiveSaveAndUpdatePosts(vars) {
    var i = vars.i
    postModel = vars.postModel
    json = vars.json
    callback = vars.callback
    realm = vars.realm
    postEdges = vars.postEdges
    if (logging) {
        console.log("this is i %s and this is json.data.length %s before checking whether to loop or not", i, json.data.length)
    }
    if (i < json.data.length) {
        if (logging) {
            console.log("this is the post we're going to try and store storing: ")
            console.log(json.data[i]);
        }
        postModel.findOne({
            "fbData.id": json.data[i].id
        }).then((post, err) => {
            // CHECK IF OUR POST LOOKUP USING FACEBOOK POST ID RETURNED ANY POSTS
            if (err) {
                console.error("there was an error when looking up a post with id " + json.data[i].id)
                console.error(err)
            } else if (post) {
                // IF THE RECEIVED POST UPDATE TIME DOES NOT MATCH THE STORED POSTS LAST UPDATED TIME WE REPLACE THE DATA AND SAVE THE HISTORY
                if (post.fbData.updated_time !== json.data[i].updated_time) {
                    post.history.push(post.fbData)
                    post.lastUpdated = json.data[i].updated_time
                    post.fbData = json.data[i]
                    post.realm = realm
                    post.save(function(err) {
                        if (err) {
                            console.error("there was an error when saving the post " + json.data[i].id)
                            console.error(err)
                            console.log("trying to save post again after error")
                            post.save(function(err) {
                                if (err) {
                                    console.error("there was an error when saving the post data for post " + json.data[i].id + " a second time")
                                    console.error(err)
                                }
                            })

                        }
                    })
                    if (logging) {
                        console.log("saved post succesfully");
                    }
                    // THEN GET THE POSTS UPDATED EDGES
                    for (var k = 0; k < postEdges.length; k++) {
                        getPostEdgeAndSave({
                            edge: postEdges[k],
                            fbId: json.data[i].id,
                            ourPostId: post._id,
                            accessToken: accessToken,
                            postModel: postModel,
                            realm: realm
                        })
                    }
                    recursiveSaveAndUpdatePosts({
                        i: i + 1,
                        postModel: postModel,
                        json: json,
                        callback: callback,
                        realm: realm,
                        postEdges: postEdges
                    })
                }
                // IF THE LAST TIME THE POST WAS UPDATED IS THE SAME AS THE LAST UPDATED TIME STORED THEN WE DO NOTHING
                else {
                    for (var k = 0; k < postEdges.length; k++) {
                        getPostEdgeAndSave({
                            edge: postEdges[k],
                            fbId: json.data[i].id,
                            ourPostId: post._id,
                            accessToken: accessToken,
                            postModel: postModel,
                            realm: realm
                        })
                    }
                    recursiveSaveAndUpdatePosts({
                        i: i + 1,
                        postModel: postModel,
                        json: json,
                        callback: callback,
                        realm: realm,
                        postEdges: postEdges
                    })
                }
            } else {
                // MAKE A NEW POST OBJECT
                var newPost = new postModel({
                        fbData: json.data[i],
                        type: "fb",
                        lastUpdated: json.data[i].updated_time,
                        realm: realm,
                        id: json.data[i].id
                    })
                    // SAVE THE NEW POST
                newPost.save(function(err) {
                    if (err) {
                        console.error("there was an error when saving the post " + json.data[i].id)
                        console.error(err)
                        console.log("trying to save post again after error")
                        newPost.save(function(err) {
                            if (err) {
                                console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                console.error(err)
                            }
                        })

                    }
                })
                if (logging) {
                    console.log(i)
                    console.log(json.data[i])
                    console.log("saved post succesfully");
                }
                recursiveSaveAndUpdatePosts({
                        i: i + 1,
                        postModel: postModel,
                        json: json,
                        callback: callback,
                        realm: realm,
                        postEdges: postEdges
                    })
                    // GET ALL THE POSTS EDGES DEFINED BY postEdges Object
                for (var k = 0; k < postEdges.length; k++) {
                    getPostEdgeAndSave({
                        edge: postEdges[k],
                        fbId: json.data[i].id,
                        ourPostId: newPost._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                }
            }
        })
    }
    // Otherwise initiate the next post request
    else {
        callback({
            page: json.paging.next,
            accessToken: accessToken,
            postModel: postModel,
            postEdges: postEdges,
            groupName: realm
        })
    }
}

function requestPosts(vars) {
    var page = vars.page
    accessToken = vars.accessToken
    postModel = vars.postModel
    groupName = vars.groupName
    postEdges = vars.postEdges
    if (logging) {
        console.log("requesting more posts from");
        console.log(page);
    }
    if (minimalFeedback) {
        currentRequests += 1
        currentPostRequests += 1
        totalPostRequests += 1
        totalRequests += 1
        console.log("total requests %s", totalRequests)
        console.log("Number of active requests %s", currentRequests)
        console.log("this is the current page: ")
        console.log(page)
    }
    request({
        method: 'GET',
        uri: page,
        gzip: true,
        timeout: 0,
        forever: true
            // ,
            // headers: {
            // 		connection: "close"
            //   }
    }, function(error, response, body) {
        // body is the decompressed response body
        // // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
        if (minimalFeedback) {
            currentRequests -= 1
            currentPostRequests -= 1
        }

        if (error) {
            if (logging) {
                console.error("there was an error, here it is: ")
                console.error(error)
                totalErrors += 1
                totalPostErrors += 1
                errors.push(error)
                postErrors.push(error)
            }
            console.error("there was an error in the http request for page data: ")
            console.error(error)
            return
        } else if (body) {
            var json = JSON.parse(body)
            if (logging) {
                console.log("succesfully received posts");
                if (json.hasOwnProperty("paging")) {
                    console.log("Here is the next page: \n%s \nand previous page: \n%s", json.paging.next, json.paging.previous)
                }
            }
            if (minimalFeedback) {
                console.log("Number of active requests %s", currentRequests)
                console.log("Number of total post requests %s", totalPostRequests)
                console.log("Number of total requests %s", totalRequests)
            }
            // Check if the returned data has any data in it (posts, events, etc..)
            if (json.data) {
                if (json.hasOwnProperty("paging")) {
                    var newLog = new log({
                        type: groupName + "GroupPostsPagingUrl",
                        data: json.paging.previous
                    })
                    newLog.save(err => {
                        if (err) {
                            console.error("there was an error saving the latest page log")
                            console.error(err)
                        }
                    })
                }

                if (json.data.length > 0) {
                    recursiveSaveAndUpdatePosts({
                        i: 0,
                        postModel: postModel,
                        json: json,
                        callback: requestPosts,
                        realm: groupName,
                        postEdges: postEdges
                    })
                }
                // If there was no data it means we have reached the end of the group and can stop trauling
                else {
                    return;
                }
            } else {
                return
            }
        }
    })
}

function cloneGroup(vars) {
    console.log("cloning group: " + vars.groupId)

    requestPosts({
        page: vars.firstUrl,
        accessToken: vars.accessToken,
        postModel: vars.postModel,
        groupName: vars.groupName,
        postEdges: vars.postEdges
    })
}

function addrealm(realm, model) {
    var stream = model.find().cursor()
    stream.on('data', function(doc) {
        arbTotalCount += 1
        console.log("this is the arbTotalCount: ")
        console.log(arbTotalCount)
        if (loggingrealmUpdate) {
            console.log(doc.realmList)
        }
        if (doc.realmList.indexOf(realm) < 0) {
            doc.realmList.push(realm)
            doc.save(function(err) {
                if (err) {
                    console.error("there was an error pushing the realm into the realm list")
                    console.error(err)
                }
            })
        }
        if (loggingrealmUpdate) {
            console.log(doc.realmList)
        }

    }).on('error', function(err) {
        console.error("there was an error in the stream")
        console.error(err)
    }).on('close', function() {
        console.log("updated all posts")
    })
}

function countCommenters(model) {
    var stream = model.find().cursor()
    stream.on('data', function(doc) {
        arbTotalCount += 1
        if (logging) {
            console.log(arbTotalCount)
                // console.log(doc.comments)
                // console.log(doc)
        }
        if (doc.comments !== null) {

            var commenterIds = []
            for (i = 0; i < doc.comments.length; i++) {
                arbTotalCount += 1
                if (commenterIds.indexOf(doc.comments[i].from.id) < 0) {
                    // Count active members
                    if (uniqueCommenters.indexOf(doc.comments[i].from.id) < 0) {
                        uniqueCommenters.push(doc.comments[i].from.id)
                    }
                    // Put commenterId into commenterIds database to register the unique id
                    commenterIds.push(doc.comments[i].from.id)
                    if (doc.commenters.indexOf(doc.comments[i].from) < 0) {
                        doc.commenters.push(doc.comments[i].from)
                    }
                }
                if (i == doc.comments.length - 1) {
                    doc.commenters = commenters
                    doc.save(function(err) {
                        if (err) {
                            console.error("there was an error when saving the document after applying commenters script: ")
                            console.log(err)
                        }
                    })
                }
            }
            if (logging) {
                console.log("this is the number of commenters: ")
                console.log(doc.commenters.length)
            }
        }


    }).on('error', function(err) {
        console.error("there was an error in the stream when calculating unique commenters")
        console.error(err)
    }).on('close', function() {
        console.log("total unique commenters was %s", uniqueCommenters.length)
        console.log("updated all posts")
    })
}

var logging = false
var loggingrealmUpdate = false
var minimalFeedback = true

cloneGroup({
    groupId: '154420241260828',
    accessToken: conf.accessToken(),
    firstUrl: "https://graph.facebook.com/v2.8/154420241260828/feed?limit=1&access_token=" + conf.accessToken(),
    postModel: post,
    groupName: "philosophy",
    postEdges: conf.postEdges
})

// addrealm("philosophy", post)
// countCommenters(post)

app.get('/', function(req, res) {
    res.render('snippets/posts');
});

app.get('/running', function(req, res) {
    res.send("Active requests: " + currentRequests + " Total post requests: " + totalPostRequests + " Total edge requests: " + totalEdgeRequests + " Total requests: " + totalRequests)
})

app.get('/stats/:stat', function(req, res) {
    var stats = {
        currentRequests: currentRequests,
        currentEdgeRequests: currentEdgeRequests,
        currentPostRequests: currentPostRequests,
        totalRequests: totalRequests,
        totalEdgeRequests: totalEdgeRequests,
        totalPostRequests: totalPostRequests,
        totalErrors: totalErrors
    }
    stats.size = function(obj) {
        var size = 0,
            key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) size++;
        }
        return size;
    };
    var stat = req.params.stat
    if (stat !== "all") {
        res.send(stat + ": " + stats[stat])
    } else if (stat == "all") {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200)
        for (var i = 0; i < stats.size(stats); i++) {
            res.write(stat + ": " + stats[i])
            if (i == stats.length - 1) {
                res.end()
            }
        }
    } else {
        res.send(500, "please request a stat")
    }
})



// Be a bot
var port = 5555;
app.listen(port);