var express = require('express')
var app = express()
url = require('url')
path = require('path')
step = require('step')
http = require('http')
https = require('https')
// limit = require('simple-rate-limiter')
// request = limit(require('request-promise')).to('20').per(3000)
request = require('request-promise')
pLimit = require('promise-limit')
quota = require('quota')
mongoose = require('mongoose')
Step = require('step')
Promise = require('bluebird')
app.set('view engine', 'pug')
app.locals.basedir = path.join(__dirname, 'views')
// FB NODE Packages in order of version number
var postRequestLimiter = pLimit(5)
var edgeRequestLimiter = pLimit(15)
var post = require('./models/post')
var log = require('./models/logs')

mongoose.Promise = Promise
var db = mongoose.createConnection("mongodb://localhost:27017/deckard")
var conf = require('./conf/fbconf')

// FB.setAccessToken(conf.appId+"|"+conf.appSecret)

let requestLog = new log({
    date: Date.now(),
    dataObj: {
        currentRequests: {
            date: Date.now(),
            value: 0
        },
        currentEdgeRequests: {
            date: Date.now(),
            value: 0
        },
        currentPostRequests: {
            date: Date.now(),
            value: 0
        },
        totalPostRequests: {
            date: Date.now(),
            value: 0
        },
        totalEdgeRequests: {
            date: Date.now(),
            value: 0
        },
        totalRequests: {
            date: Date.now(),
            value: 0
        },
        totalErrors: {
            date: Date.now(),
            list: []
        },
        totalPostErrors: {
            date: Date.now(),
            list: []
        },
        totalEdgeErrors: {
            date: Date.now(),
            list: []
        },
    }
})

function cloneGroup(vars) {
    console.log("cloning group: " + vars.groupId)

    requestPostsAndSave({
        page: vars.firstUrl,
        accessToken: vars.accessToken,
        postModel: vars.postModel,
        groupName: vars.groupName,
    })
}

function requestPostsAndSave(vars) {
    let page = vars.page
    let accessToken = vars.accessToken
    let postModel = vars.postModel
    let groupName = vars.groupName
    if (logging) {
        console.log("requesting more posts from");
        console.log(page);
        requestLog.date = Date.now()
        requestLog.dataObj.currentPostRequests.value += 1
        requestLog.dataObj.currentRequests.value += 1
        requestLog.dataObj.totalPostRequests.value += 1
        requestLog.dataObj.totalRequests.value += 1
        if (loggingSave) {
            requestLog.save(err => {
                if (!err) {
                    return
                } else {
                    requestLog.dataObj.totalErrors.list.push(err)
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            console.error("there was another error")
                            console.error(err)
                        }
                    })
                }
            })
        }
    }
    if (minimalFeedback) {
        console.log("total requests %s", requestLog.dataObj.totalRequests.value)
        console.log("Number of active requests %s", requestLog.dataObj.currentRequests.value)
        console.log("this is the current page: ")
        console.log(page)
        console.log("postRequestLimiter", postRequestLimiter)
        console.log("Number of functions in the post request queue %s", postRequestLimiter.queue)
    }
    let options = {
        method: 'GET',
        uri: page,
        gzip: true,
        timeout: 0,
        forever: true
        //             // ,
        //             // headers: {
        //             // 		connection: "close"
        //             //   }
    }
    logOptions(options)
    postRequestLimiter(() => {
            return requestThrottled(options)
        })
        .then(function (body, error) {
            if (logging) {
                requestLog.date = Date.now()
                requestLog.dataObj.currentPostRequests.value -= 1
                requestLog.dataObj.currentRequests.value -= 1
                if (loggingSave) {
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            requestLog.dataObj.totalErrors.list.push(err)
                            requestLog.save(err => {
                                if (!err) {
                                    return
                                } else {
                                    console.error("there was another error")
                                    console.error(err)
                                }
                            })
                        }
                    })
                }
            }
            savePostData(vars, body, error)
        })
        .catch(function (err) {
            if (logging) {
                requestLog.date = Date.now()
                requestLog.dataObj.currentPostRequests.value -= 1
                requestLog.dataObj.currentRequests.value -= 1
                if (loggingSave) {
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            requestLog.dataObj.totalErrors.list.push(err)
                            requestLog.save(err => {
                                if (!err) {
                                    return
                                } else {
                                    console.error("there was another error")
                                    console.error(err)
                                }
                            })
                        }
                    })
                }
            }
            console.error("there was an error requesting posts")
            console.error(err)
        })
}

function savePostData(vars, body, error) {
    let page = vars.page
    let accessToken = vars.accessToken
    let postModel = vars.postModel
    let groupName = vars.groupName
    // body is the decompressed response body
    // // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
    if (error) {
        if (logging) {
            console.error("there was an error, here it is: ")
            console.error(error)
            requestLog.date = Date.now()
            requestLog.dataObj.totalErrors.list.push(error)
            requestLog.dataObj.totalPostErrors.list.push(error)
            if (loggingSave) {
                requestLog.save(err => {
                    if (!err) {
                        return
                    } else {
                        requestLog.dataObj.totalErrors.list.push(err)
                        requestLog.save(err => {
                            if (!err) {
                                return
                            } else {
                                console.error("there was another error")
                                console.error(err)
                            }
                        })
                    }
                })
            }
        }
        console.error("there was an error in the http request for page data: ")
        console.error(error)
        return
    } else if (body) {
        if (minimalFeedback) {
            console.log("we got a body response")
            console.log(body)
        }
        let json = JSON.parse(body)
        if (logging) {
            console.log("succesfully received posts");
            if (json.hasOwnProperty("paging")) {
                console.log("Here is the next page: \n%s \nand previous page: \n%s", json.paging.next, json.paging.previous)
            }
        }
        if (minimalFeedback) {
            console.log("Number of active requests %s", requestLog.dataObj.currentRequests.value)
            console.log("Number of total post requests %s", requestLog.dataObj.totalPostRequests.value)
            console.log("Number of total requests %s", requestLog.dataObj.totalRequests.value)
        }
        // Check if the returned data has any data in it (posts, events, etc..)
        if (json.data) {
            if (json.hasOwnProperty("paging")) {
                // var newLog = new log({
                //     type: groupName + "GroupPostsPagingUrl",
                //     data: json.paging.previous
                // })
                // newLog.save(err => {
                //     if (err) {
                //         console.error("there was an error saving the latest page log")
                //         console.error(err)
                //     }
                // })
            }

            if (json.data.length > 0) {
                recursiveSaveAndUpdatePosts({
                    accessToken: accessToken,
                    i: 0,
                    postModel: postModel,
                    json: json,
                    callback: requestPostsAndSave,
                    realm: groupName,
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
}

function recursiveSaveAndUpdatePosts(vars) {
    let i = vars.i
    let postModel = vars.postModel
    let json = vars.json
    let callback = vars.callback
    let realm = vars.realm
    let accessToken = vars.accessToken
    if (logging) {
        console.log("this is i %s and this is json.data.length %s before checking whether to loop or not", i, json.data.length)
    }
    if (i < json.data.length) {
        if (logging) {
            // console.log("this is the post we're going to try and store storing: ")
            // console.log(json.data[i]);
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
                    let history = new limitedList(5)
                    for (let historical of post.history) {
                        history.push(historical)
                    }
                    history.push(post.fbData)
                    post.history = history
                    post.lastUpdated = json.data[i].updated_time
                    post.fbData = json.data[i]
                    post.realm = realm
                    post.save(function (err) {
                        if (err) {
                            console.error("there was an error when saving the post " + json.data[i].id)
                            console.error(err)
                            console.log("trying to save post again after error")
                            post.save(function (err) {
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
                    conf.postEdges.forEach(postEdge => {
                        requestEdgeAndSave({
                            edge: postEdge,
                            fbId: json.data[i].id,
                            ourPostId: post._id,
                            accessToken: accessToken,
                            postModel: postModel,
                            realm: realm
                        })
                    })
                    recursiveSaveAndUpdatePosts({
                        accessToken: accessToken,
                        i: i + 1,
                        postModel: postModel,
                        json: json,
                        callback: callback,
                        realm: realm,

                    })
                }
                // IF THE LAST TIME THE POST WAS UPDATED IS THE SAME AS THE LAST UPDATED TIME STORED THEN WE DO NOTHING
                else {
                    conf.postEdges.forEach(postEdge => {
                        requestEdgeAndSave({
                            edge: postEdge,
                            fbId: json.data[i].id,
                            ourPostId: post._id,
                            accessToken: accessToken,
                            postModel: postModel,
                            realm: realm
                        })
                    })
                    recursiveSaveAndUpdatePosts({
                        accessToken: accessToken,
                        i: i + 1,
                        postModel: postModel,
                        json: json,
                        callback: callback,
                        realm: realm,

                    })
                }
            } else {
                // MAKE A NEW POST OBJECT
                var newPost = new postModel({
                    fbData: json.data[i],
                    type: "fbPost",
                    lastUpdated: json.data[i].updated_time,
                    realm: realm,
                    id: json.data[i].id
                })
                // SAVE THE NEW POST
                newPost.save(function (err) {
                    if (err) {
                        console.error("there was an error when saving the post " + json.data[i].id)
                        console.error(err)
                        console.log("trying to save post again after error")
                        newPost.save(function (err) {
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
                    accessToken: accessToken,
                    i: i + 1,
                    postModel: postModel,
                    json: json,
                    callback: callback,
                    realm: realm,
                })
                // GET ALL THE POSTS EDGES DEFINED BY postEdges Object
                conf.postEdges.forEach(postEdge => {
                    requestEdgeAndSave({
                        edge: postEdge,
                        fbId: json.data[i].id,
                        ourPostId: newPost._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                })

            }
        })
    }
    // Otherwise initiate the next post request
    else {
        callback({
            page: json.paging.next,
            accessToken: accessToken,
            postModel: postModel,
            groupName: realm
        })
    }
}

function requestThrottledQuota(options) {
    return new Promise((resolve, reject) => {
        var _grant;
        quotaClient.requestQuota('custom', {}, {
                requests: 1
            }, {
                maxWait: 10000000 // Each request will be queued for 60 seconds and discarded if it didn't get a slot to be executed until then
            })
            .then(function (grant) {
                _grant = grant;
                return request(options)
                    .then(function (body, error) {
                        resolve(body, error)
                        return
                    }).catch(function (err) {
                        reject(err)
                        return
                    })
            })
            .finally(function () {
                if (_grant) {
                    _grant.dismiss();
                }
            });

    })
}

function requestThrottled(options) {
    return new Promise((resolve, reject) => {
        request(options)
            .then(function (body, error) {
                resolve(body, error)
            }).catch(function (err) {
                reject(err)
            })
    })
}

function requestEdgeAndSave(vars) {
    let edge = vars.edge
    let fbId = vars.fbId
    let ourPostId = vars.ourPostId
    let accessToken = vars.accessToken
    let postModel = vars.postModel
    let realm = vars.realm
    let url = "https://graph.facebook.com/v2.8/" + fbId + "/" + edge + "?limit=600&access_token=" + accessToken
    if (logging) {
        console.log("requesting edge: ")
        console.log(edge);
        console.log("from fb post: ")
        console.log(fbId);
        console.log("with url %s", url)
        requestLog.date = Date.now()
        requestLog.dataObj.currentEdgeRequests.value += 1
        requestLog.dataObj.currentRequests.value += 1
        requestLog.dataObj.totalEdgeRequests.value += 1
        requestLog.dataObj.totalRequests.value += 1
        if (loggingSave) {
            requestLog.save(err => {
                if (!err) {
                    return
                } else {
                    requestLog.dataObj.totalErrors.list.push(err)
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            console.error("there was another error")
                            console.error(err)
                        }
                    })
                }
            })
        }
    }
    if (minimalFeedback) {
        console.log("Number of total requests %s", requestLog.dataObj.totalRequests.value)
        console.log("Number of active requests %s", requestLog.dataObj.currentRequests.value)
        console.log("Number of functions in the edge request queue %s", edgeRequestLimiter.queue)
    }
    let options = {
        method: 'GET',
        uri: url,
        gzip: true,
        timeout: 0,
        forever: true
        // ,
        // headers: {
        // 		connection: "close"
        // 	}
    }
    logOptions(options)
    edgeRequestLimiter(() => {
            return requestThrottled(options)
        })
        .then(function (body, error) {
            if (logging) {
                requestLog.date = Date.now()
                requestLog.dataObj.currentEdgeRequests.value -= 1
                requestLog.dataObj.currentRequests.value -= 1
                if (loggingSave) {
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            requestLog.dataObj.totalErrors.list.push(err)
                            requestLog.save(err => {
                                if (!err) {
                                    return
                                } else {
                                    console.error("there was another error")
                                    console.error(err)
                                }
                            })
                        }
                    })
                }
            }
            saveEdgeData(vars, body, error)
        })
        .catch(function (err) {
            if (logging) {
                requestLog.date = Date.now()
                requestLog.dataObj.currentEdgeRequests.value -= 1
                requestLog.dataObj.currentRequests.value -= 1
                requestLog.dataObj.totalEdgeErrors.list.push(err)
                if (loggingSave) {
                    requestLog.save(err => {
                        if (!err) {
                            return
                        } else {
                            requestLog.dataObj.totalErrors.list.push(err)
                            requestLog.save(err => {
                                if (!err) {
                                    return
                                } else {
                                    console.error("there was another error")
                                    console.error(err)
                                }
                            })
                        }
                    })
                }
            }
            console.error("there was an error looking up the edge %s", edge)
            console.error(err)
        })
}

function saveEdgeData(vars, body, error) {
    // body is the decompressed response body
    // // console.log('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
    let edge = vars.edge
    let fbId = vars.fbId
    let ourPostId = vars.ourPostId
    let accessToken = vars.accessToken
    let postModel = vars.postModel
    let realm = vars.realm

    if (error) {
        if (logging) {
            console.error("there was an error requesting the edge %s, here is the error: ", edge)
            console.error(error)
            requestLog.date = Date.now()
            requestLog.dataObj.totalErrors.list.push(error)
            requestLog.dataObj.totalEdgeErrors.list.push(error)
            if (loggingSave) {
                requestLog.save(err => {
                    if (!err) {
                        return
                    } else {
                        requestLog.dataObj.totalErrors.list.push(err)
                        requestLog.save(err => {
                            if (!err) {
                                return
                            } else {
                                console.error("there was another error")
                                console.error(err)
                            }
                        })
                    }
                })
            }
        }
        return
    } else if (body) {
        let json = JSON.parse(body)
        if (logging) {
            console.log("succesfully received edge %s from post %s", edge, fbId);
            console.log(json)
        }
        if (minimalFeedback) {
            console.log("Number of active requests %s", requestLog.dataObj.currentRequests.value)
            console.log("Number of post requests %s", requestLog.dataObj.totalPostRequests.value)
            console.log("Number of total requests %s", requestLog.dataObj.totalRequests.value)
        }
        // Check if there is any data to process
        if (json.data && json.data.length > 0) {
            // If edge was not attachments, simply save edge as the returned data
            postModel.findOne({
                _id: ourPostId
            }).then((post, err) => {
                if (err) {
                    console.error("there was an error when trying to find a post while saving abitrary attachment data")
                    console.error(err)
                    return
                } else if (post) {
                    if (edge == "comments" && json.data) {
                        Promise.map(json.data, comment => {
                            return postModel.findOne({
                                "fbData.id": comment.id
                            })
                        }).then(commentDocs => {
                            if (commentDocs.length > 0) {
                                handleComments({
                                    i: 0,
                                    commentDocs: commentDocs,
                                    post: post,
                                    json: json,
                                    postModel: postModel,
                                    accessToken: accessToken
                                })
                                return
                            } else {
                                return
                            }


                        })
                    } else if (edge == "attachments") {
                        if (json.data.type == "photo") {
                            post[edge].data.push(json.data[0].media)
                            post.image = json.data[0].media.src
                            post.save(function (err) {
                                if (err) {
                                    console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                    console.error(err)
                                    console.error("trying to save post again after error")
                                    post.save(function (err) {
                                        if (err) {
                                            console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                            console.error(err)
                                            return
                                        }
                                    })

                                } else {
                                    return
                                }
                            })
                        }
                        // If the attachment was not a photo we simply return, we will handle other attachments later :)
                        else {
                            return
                        }
                    } else {
                        if (post[edge].data.length > 0) {
                            let history = new limitedList(5)
                            for (let historical of post[edge].history) {
                                history.push(historical)
                            }
                            history.push({
                                data: post[edge].data,
                                date: Date.now()
                            })
                            post[edge].history = history
                            post[edge].data = json.data
                            post.save(err => {
                                if (err) {
                                    console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                    console.error(err)
                                    console.log("trying to save post again after error")
                                    post.save(function (err) {
                                        if (err) {
                                            console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                            console.error(err)
                                            return
                                        } else {
                                            return
                                        }
                                    })
                                } else {
                                    return
                                }
                            })

                        } else {
                            post[edge].data = json.data
                            post.save(function (err) {
                                if (err) {
                                    console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                    console.error(err)
                                    console.log("trying to save post again after error")
                                    post.save(function (err) {
                                        if (err) {
                                            console.error("there was an error when saving the edge data for edge " + edge + " to post " + ourPostId)
                                            console.error(err)
                                            return
                                        } else {
                                            return
                                        }
                                    })
                                } else {
                                    return
                                }
                            })
                        }

                    }
                } else {
                    console.error("we found no post when searching for id: " + ourPostId)
                    return
                }
            })


        } else {
            return
        }
    }
}

function handleComments(vars) {
    let i = vars.i
    let post = vars.post
    let commentDocs = vars.commentDocs
    let max = commentDocs.length
    let json = vars.json
    let postModel = vars.postModel
    let realm = vars.realm
    let accessToken = vars.accessToken
    if (i >= max - 1) {
        return
    } else {
        if (commentDocs[i]) {
            if (commentDocs[i].fbData.message !== json.data[i].message) {
                let history = new limitedList(5)
                for (let historical of commentDocs[i].history) {
                    history.push(historical)
                }
                history.push(commentDocs[i].fbData)
                commentDocs[i].history = history
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
                                handleComments(vars)
                            }
                        })
                    } else {
                        vars.i += 1
                        handleComments(vars)
                    }
                })
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
                                    handleComments(vars)
                                }
                            })
                        } else {
                            vars.i += 1
                            handleComments(vars)
                        }
                    })
                }
                conf.commentEdges.forEach(commentEdge => {
                    requestEdgeAndSave({
                        edge: commentEdge,
                        fbId: commentDocs[i].fbData.id,
                        ourPostId: commentDocs[i]._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                })
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
                                    handleComments(vars)
                                }
                            })
                        } else {
                            vars.i += 1
                            handleComments(vars)
                        }
                    })
                } else {
                    vars.i += 1
                    handleComments(vars)
                }
            }
        } else if (json.data[i]) {
            var newCommentPost = new postModel({
                fbData: json.data[i],
                realm: realm,
                id: json.data[i].id,
                lastUpdated: json.data[i].created_time,
                type: "fbComment"
            })
            newCommentPost.save(err => {
                if (err) {
                    console.error("there was an error saving the newCommentPost with id: " + newCommentPost.fbData.id)
                    console.error(err)
                    newCommentPost.save(err => {
                        if (err) {
                            console.error("there was an error saving the newCommentPost with id: " + newCommentPost.fbData.id)
                            console.error(err)
                        } else {
                        }
                    })
                } else {
                }
            })
            if (post.comments.data.indexOf(newCommentPost.fbData.id) < 0) {
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
                                handleComments(vars)

                            }

                        })
                    } else {
                        vars.i += 1
                        handleComments(vars)

                    }
                })
                conf.commentEdges.forEach(commentEdge => {
                    requestEdgeAndSave({
                        edge: commentEdge,
                        fbId: newCommentPost.fbData.id,
                        ourPostId: newCommentPost._id,
                        accessToken: accessToken,
                        postModel: postModel,
                        realm: realm
                    })
                })
            }
        }
    }
}

function addrealm(realm, model) {
    var stream = model.find().cursor()
    stream.on('data', function (doc) {
        arbTotalCount += 1
        console.log("this is the arbTotalCount: ")
        console.log(arbTotalCount)
        if (loggingrealmUpdate) {
            console.log(doc.realmList)
        }
        if (doc.realmList.indexOf(realm) < 0) {
            doc.realmList.push(realm)
            doc.save(function (err) {
                if (err) {
                    console.error("there was an error pushing the realm into the realm list")
                    console.error(err)
                }
            })
        }
        if (loggingrealmUpdate) {
            console.log(doc.realmList)
        }

    }).on('error', function (err) {
        console.error("there was an error in the stream")
        console.error(err)
    }).on('close', function () {
        console.log("updated all posts")
    })
}

function countCommenters(model) {
    var stream = model.find().cursor()
    stream.on('data', function (doc) {
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
                    doc.save(function (err) {
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


    }).on('error', function (err) {
        console.error("there was an error in the stream when calculating unique commenters")
        console.error(err)
    }).on('close', function () {
        console.log("total unique commenters was %s", uniqueCommenters.length)
        console.log("updated all posts")
    })
}

function limitedList(length) {
    var array = new Array();

    array.push = function () {
        if (this.length >= length) {
            this.shift();
        }
        return Array.prototype.push.apply(this, arguments);
    }

    return array;

}

function saveRecursively(args) {
    /*
        Expects @args
        @arg name is some reference so we know what the error means
        @arg model is a mongoose model
        @arg i is the current count
        @arg max is the max ammount of times we try to save
    */
    if (!args) {
        let args = {}
    }
    if (!args.curCount) args.curCount = 0
    if (args.curCount >= args.max) {
        return
    } else if (args.model) {
        args.model.save(err => {
            if (err) {
                console.log("there was an error saving a model with name %s", args.name)
                args.curCount += 1
                saveRecursively(args)
            } else {
                console.log("successfully saved the model after %s attempts", args.curCount)
            }
        })
    }
}

function logOptions(options) {
    if (options) {
        let optionLog = new log({
            date: Date.now(),
            type: 'optionLog',
            dataObj: {
                options: options
            }
        })
        saveRecursively({
            model: optionLog,
            max: 6
        })
    }
}
var logging = true
var loggingSave = false
var minimalFeedback = true

cloneGroup({
    groupId: '154420241260828',
    accessToken: conf.accessToken(),
    firstUrl: "https://graph.facebook.com/v2.8/154420241260828/feed?limit=5&access_token=" + conf.accessToken(),
    postModel: post,
    groupName: "philosophy",
})

// addrealm("philosophy", post)
// countCommenters(post)

app.get('/', function (req, res) {
    res.render('snippets/posts');
});

app.get('/running', function (req, res) {
    res.send("Active requests: " + currentRequests + " Total post requests: " + totalPostRequests + " Total edge requests: " + totalEdgeRequests + " Total requests: " + totalRequests)
})

app.get('/stats/:stat', function (req, res) {
    var stats = {
        currentRequests: currentRequests,
        currentEdgeRequests: currentEdgeRequests,
        currentPostRequests: currentPostRequests,
        totalRequests: totalRequests,
        totalEdgeRequests: totalEdgeRequests,
        totalPostRequests: totalPostRequests,
        totalErrors: totalErrors
    }
    stats.size = function (obj) {
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