# 5b5t Auto item duper

## Dupes items including shulkers on 5b5t

## Over stacked shulkers are enabled again so this is useless now lol

## Installing
### If you only want to use it to dupe items on 5b5t: 
Clone this repository onto your computer with
```text
git clone https://github.com/IceTank/mineflayer-5b5t-auto-duper.git
cd mineflayer-5b5t-auto-duper
npm i
```
And see the example explanation at the bottom.


### If you want to use it as a plugin in an existing project:
Install it with npm as a module:
```text
npm i --save https+github.com/IceTank/mineflayer-5b5t-auto-duper.git
```
And then use it as a plugin
```javascript
// import the plugin
const autodupePlugin = require('mineflayer-5b5t-auto-dupe')

// load the plugin once the bot has joined the server
bot.once('spawn', () => {
  bot.loadPlugin(autodupePlugin)
})

// You can now use the functions provided the the plugin
bot.on('chat', async (username, message) => {
  const cmd = message.split(' ')
  await bot.autodupe.dupe(cmd[0], cmd[1])
  bot.chat('Finished')
})
```

## 5b5t auto dupe example
See example `index.js` in `example`

The example is able to dupe any items with the crafting recipe dupe glitch present on 5b5t. This includes shulker boxes and other items that automatically get refereed by the anti stack plugin.

To use it run 
```bash
npm start <email> <password> [isMojangAccount ("true"|"false")]
```
You might have to wrap your username and password in `""` for it to work.

### Commands:

#### `dupe <item name> [stack amount]` 
Dupes any item. Has to have at least 8 oak wood plank in its inventory to work. Note: the dupe methode is not perfect and might fail. The bot should only have one shulker of the given color it should dupe in its inventory to not mess up.The given stack amount is not always reached. Bot sends a whisper back or logs in console when it is finished.  

#### `items [search string]`
Prints out all items found in its inventory.

#### `drop <item name> [amount]`
Drops items with a given item name or partial name to the closest play or onto the ground.

#### `stack`
Rearange items in its inventory so that no item stack is bigger then 64. Might drop items onto the ground.

#### `quit`
Exits the program and bot

#### `where`
Prints out at what coordinates the bot currently is.

#### `goto <(x y z) | (x z) | (y)>`
Pathfinds to specific coordinates

#### `follow`
Follows the player how send the whisper to the bot if he is in render distance.

#### `stop`
Stop pathfinding

#### `come`
Pathfind to the player how send the whisper if he is in render distance.
