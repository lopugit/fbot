/**
 *  This is where you run free
 */

// fbot.cloneGroup({
    //     groupId: '154420241260828',
    //     accessToken: fbconf.accessToken(),
    //     firstUrl: "https://graph.facebook.com/v2.8/154420241260828/feed?limit=5&access_token=" + fbconf.accessToken(),
    //     postModel: post,
    //     groupName: "philosophy",
    // })

// auto.addrealm("source", post, {
    //     type: {
    //         $regex: 'post',
    //         $options: 'i'
    //     }
    // })
// auto.countCommenters(post)
// auto.addOwner(thing)
// goose.renameProperties(thing, [
    //     ["resources", "things"],
    //     ["resourceId", "trueId"],
    //     ["description", "text"]
    // ])
// goose.undefineProperties(thing, [
    //     "resources",
    //     "resourceId",
    //     "description",
    //     "resourceSynonyms",
    //     "letters",
    //     "exists",
    //     "states",
    //     "state",
    //     "stateType",
    //     "history",
    //     "uniques",
    //     // "properties",
    //     // "source",
    //     "resource"
    // ])

// auto.addRealmToNamesConditionally(thing, [
    //     ["likes", "facebook-"]
    // ])

// goose.undefineProperties(thing, [
    //     "properties"
    // ])
// auto.transformStringPropertyToList(thing, 'owner', 'owners')
// auto.stream(thing)
/** testing smart opts
 * 
 */
  // let opt = {
  //     woo: 'yee'
  // }

  // let listt = [
  //     opt,
  //     {
  //         woo: 'test'
  //     },
  //     {
  //         huh: 'aha'
  //     }
  // ]
  // console.log(smartOpts.optIndex(opt, listt, true, 'woo'))
  // console.log(smartOpts.optIn(opt, listt, true, 'woo'))

/** fixing the naming loss of facebook comment inventories 
 */
let edges = ['comments', 'likes', 'shares', 'reactions', 'attachments']
// for(edge of edges){
//   auto.fixNames(thing, 'inventory', edge, 'facebook-'+edge)
// }  
// for(edge of edges){
//   auto.fixTitles(thing, 'facebook-'+edge)
// }

/** add unique title property to all facebook edge inventories 
 */
  // for(edge of edges){
  //   auto.addUniqueTitleProperty(thing, 'facebook-'+edge)
  // }
  