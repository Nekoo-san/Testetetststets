const axios = require('axios');
require('dotenv').config();

const sleep = time => new Promise(res => setTimeout(res, time * 1000));

const get = async (url) => {
    try {
        const request = await axios.get(`https://${url}`);
        if (request.status !== 200) throw new Error('Request failed');
        return request.data;
    } catch (error) {
        console.error(`[ERROR] Failed to GET from ${url}: ${error.message}`);
        await sleep(1);
        return await get(url);
    }
};

async function fetchOnlineFriends(userId) {
    console.log(`[INFO] Fetching online friends for user ID: ${userId}...`);
    const friendsResponse = await get(`friends.roblox.com/v1/users/${userId}/friends`);
    const onlineFriends = friendsResponse.data.filter(friend => friend.isOnline);
    console.log(`[INFO] Found ${onlineFriends.length} online friends for user ID: ${userId}.`);
    return onlineFriends;
}

async function fetchAndCheckFriendsOfFriends(mainUserId, friend, serverThumbnails, mainUserFriends, tree, prefix) {
    const friendsOfFriend = await fetchOnlineFriends(friend.id);
    const subTree = {};

    for (const subFriend of friendsOfFriend) {
        // Skip the main user and any friends already connected to the main user
        if (subFriend.id === mainUserId || mainUserFriends.some(f => f.id === subFriend.id)) continue;

        try {
            const subFriendThumbResponse = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${subFriend.id}&size=150x150&format=Png&isCircular=false`);
            const subFriendThumb = subFriendThumbResponse.data[0].imageUrl;
            console.log(`[DEBUG] Checking friend of friend: ${subFriend.name} (${subFriendThumb})`);

            const isSubFriendInServer = serverThumbnails.includes(subFriendThumb);

            subTree[subFriend.name] = isSubFriendInServer ? "[IN SERVER]" : "[ONLINE]";
        } catch (error) {
            console.error(`[ERROR] Failed to fetch thumbnail for friend of friend ${subFriend.name}: ${error.message}`);
        }
    }

    if (Object.keys(subTree).length > 0) {
        tree[friend.name] = subTree;
    }
}

function printTree(tree, prefix = '') {
    const keys = Object.keys(tree);
    keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const newPrefix = prefix + (isLast ? '└───' : '├───');
        console.log(newPrefix + key + " " + tree[key]);

        if (typeof tree[key] === 'object') {
            printTree(tree[key], prefix + (isLast ? '    ' : '│   '));
        }
    });
}

async function findFriendsInServer(userId, placeId, serverId, allThumbnails) {
    const onlineFriends = await fetchOnlineFriends(userId);
    const tree = {};

    if (onlineFriends.length === 0) {
        console.log('[INFO] No online friends found.');
        return tree;  // Rückgabe des leeren Baums
    }

    const serverThumbnails = allThumbnails.get(serverId) || [];

    console.log('[INFO] Comparing online friends with players in the server...');
    console.log(`[DEBUG] Server player thumbnails: ${serverThumbnails.join(', ')}`);

    for (const friend of onlineFriends) {
        try {
            const friendThumbResponse = await get(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${friend.id}&size=150x150&format=Png&isCircular=false`);
            const friendThumb = friendThumbResponse.data[0].imageUrl;
            console.log(`[DEBUG] Checking friend: ${friend.name} (${friendThumb})`);

            const isFriendInServer = serverThumbnails.includes(friendThumb);

            if (isFriendInServer) {
                console.log(`[SUCCESS] Friend ${friend.name} is in the same server with the user.`);
                tree[friend.name] = "[IN SERVER]";

                // Check online friends of this friend, but exclude friends that are also friends with the main user
                await fetchAndCheckFriendsOfFriends(userId, friend, serverThumbnails, onlineFriends, tree, "");
            } else {
                tree[friend.name] = "[ONLINE]";
                console.log(`[INFO] Friend ${friend.name} is online but not in the same server.`);
            }
        } catch (error) {
            console.error(`[ERROR] Failed to fetch thumbnail for friend ${friend.name}: ${error.message}`);
        }
    }

    // Log the tree in the console
    console.log("\nFriendship Tree:");
    printTree(tree);
    console.log("\nFriendship Tree (JSON):", JSON.stringify(tree, null, 2));

    return tree; // Return the constructed tree
}

module.exports = { findFriendsInServer };