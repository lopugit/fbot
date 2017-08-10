function insertComment(vars) {
    // goes through all comments in post and inserts the given commentId where 
    var comment = vars.comment
    post = vars.post
    postModel = vars.postModel
    if (post.comments.data.length > 0) {
        var minDate = null
        for (commentNum in post.comments.data) {
            postModel.findOne({
                "fbData.id": post.comments.data[commentNum]
            }).then((commentPost2, err) => {
                if (err) {
                    console.error("there was an error looking up the post which is really a comment")
                    console.error(err)
                } else if (commentPost2) {
                    if (commentPost2.fbData.created_time < comment.fbData.created_time) {
                        if (commentNum == post.comments.data.length - 1) {
                            post.comments.data.push(comment.fbData.id)
                        }
                    } else if (commentPost2.fbData.created_time >= comment.fbData.created_time) {
                        post.comments.data.push(null)
                        for (var i = post.comments.data.length - 1; i > commentNum; i--) {
                            post.comments.data[i] = post.comments.data[i - 1]
                        }
                        post.comments.data[commentNum] = comment.fbData.id
                    }
                } else {
                    console.error("there was no post data found for the post/comment id " + post.comments[commentNum])

                }
            })
        }
    } else {
        console.log("there were no comments in the post yet so we put the first one in")
        post.comments.data.push(comment.fbData.id)
    }
}

function commentStored(vars) {
    var commentId = vars.commentId
    post = vars.post
    if (post.comments.length > 0) {
        for (comment in post.comments) {
            if (post.comments[comment] == commentId) {
                return true
            } else if (comment == post.comments.length - 1) {
                return false
            }
        }
    } else {
        return false
    }
}