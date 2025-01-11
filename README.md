# tpapro

## 安装方法

1. 前往插件release页面下载tpapro最新的发行版。
2. 解压压缩包，将其中的llse/tpapro文件夹复制粘贴到服务器的plugins文件夹，所有同名文件夹合并，所有同名文件替换
3. 检查服务端的server.properties文件中的`server-authoritative-movement`并确保其没有被设置为`client-auth`。
4. 开启服务器，或通过插件加载器提供的方式加载插件。

## 配置文件和数据库迁移

**自1.3.0开始，玩家数据将保存到sqlite3数据库文件data.db中，配置文件将使用config.yml。**

配置文件和数据库将会自动开始迁移，所有原有数据都会带上.bak的后缀。要想读取原来的数据，可以直接使用文件编辑器打开那些文件。

> [!WARNING]
> 请勿将旧文件去掉.bak后放在插件数据文件夹中。插件将会认为该文件是未迁移数据的文件，并使用其中数据覆盖现有数据！

## 使用


指令：

- `/tpa preferences`：打开设置
- `/tpa`：选择tpa的目标
- `/tpa here`：选择tpahere的目标
- `/tpa accept`：设置为在聊天中显示时接受请求
- `/tpa deny`：设置为在聊天中显示时拒绝请求


玩家可以输入/tpa preference来调整针对自己的设置。执行该命令后，插件将打开设置菜单，内容如下：
- tpa开关即为上文提到的关闭tpa。
- “接收到tpa请求时” 有三个选项：自动接受、弹窗提醒、在聊天中显示。如果玩家设置了自动接受，那么在其他玩家向他发送tpa时，将立即开始传送。
- 请求有效时间是在聊天中显示或弹窗点击暂存后请求的有效期，取决于请求发送者，范围是1-2147438647之间的整数，超出这个范围会被纠正，在后台修改individualpreferences.json可以使这个值超出范围，但再次打开设置并保存时仍然会被系统纠正

### 管理员命令

- `/tpamgr reload`：重载插件配置文件（仅管理员可用）
- `/tpamgr db unload`：关闭数据库连接。关闭后插件大部分功能都将不可用。
- `/tpamgr db load`：恢复数据库连接。
- `/tpamgr db exe <sqlite3语句>`：执行数据库操作


## 配置文件
新版配置文件内容如下（不会生成注释）：
```yaml
# 玩家进服时的默认设置
default_preferences: 
    # tpa开关默认状态
    active: true,
    # 在聊天中显示模式下或将请求暂存后的请求有效期，单位毫秒（未测试不是1-2147438647之间的整数的可行性，超出范围请谨慎使用）
    request_available: 120000,
    # 接收到tpa请求时的选择，0为自动接受，1为弹窗提醒，2为在聊天中显示，超出这个范围会导致/tpa preference报错且玩家收不到tpa请求
    accep_tmode: 2,
    # ？
    random_active: false
frequency_limit: 
    # 是否限制tpa频率
    active: true,
    # 在time_limit毫秒内成功发送requests_limit次后再发送就会被拒绝。
    time_limit: 30000,
    requests_limit: 5,
    # 玩家传送过于频繁时需要额外支付的价格，最终玩家需要支付economy.price+frequency_limit.price的费用。如果设置为0，插件将不允许通过此时支付额外费用来传送
    limit_price: 0,
    # vip玩家无视频率限制，仍支付原价格
    vip_limit_free: true,
    # vip玩家享受对额外支付的部分的折扣
    vip_limit_discount: 0.5,
    # vip玩家独立的频率限制
    vip_limit: 
        # 是否启用该限制
        active: false,
        # 同上文
        time_limi": 30000,
        requests_limit: 10
# 经济配置
economy: 
    # 货币名称
    currency: money,
    # 价格
    price: 0,
    # 对vip玩家免费
    vip_free: true,
    # vip玩家享受的折扣
    vip_discount: 0.5,
    #货币在游戏中的显示名称
    name: 积分
# 插件语言
lang: zh_cn
# 允许观察者模式玩家传送
allow_spc_tp: 0
```

> [!NOTE]
> 数据库管理请通过`/tpamgr db exe <sqlite3语句>`命令或关闭数据库连接后通过sqlite3数据库管理软件打开data.db

<!--


其中，default_preferences对象存储

    active是
    requestavailable是
    acceptmode

frequency_limit是频率限制

    active是是否开启该功能
    time_limit和requests_limit是
    limit_price是

economy对象存储经济有关的信息

    type是经济核心的种类，可选llmoney（LLmoney），scoreboard（计分板），TMEssential（TMET）如果您没有找到自己正在使用的经济核心，欢迎向我反馈。如果您打算从服务器中卸载llmoney，请不要将此项设置为llmoney，这会导致LLSE无法调用API并报错
    object是经济核心使用的经济名称，仅在核心支持多经济时修改，如计分板需要将此项改为计分板名称
    price是传送的价格。如果设置为0则为免费
    name是您的服务器中对该经济的称呼

其他此处未说明的设置项是为未来功能的预留项，修改后不会影响插件功能，但仍不建议修改，以防更新插件时出现问题


为什么有些正式版预定的大饼不画了？详见开头


tpa2中将会加入：

    群发tpa，可以一次性选择多个玩家传送，也可以快捷向所在工会所有玩家发送
    全局频率限制，如果全服玩家频繁传送将暂时禁用所有人的tpa
    tps过低（暂定对接QueryTPS）、网络上行过高时暂时禁用所有人的tpa
    对接一些权限组插件，vip用户可以不受频率限制或享受折扣（考虑到潜在的因mojang eula造成的风险，该功能开发计划被延后）
    根据领地插件设置tpa禁区
    玩家可以将特定的玩家加入白名单或黑名单，只有他自己允许的玩家可以对他发起请求
    开发者

导出函数：

本插件所有导出函数的命名空间都是“tpapro”。

以下是各导出名称导出的函数：

tpaFrequently

检查特定的玩家此时是否传送过于频繁

原型：func(Player);

参数：

Player：玩家对象，要检查的玩家

返回值：Bool，是否传送过于频繁

getPlayerFromName

用玩家名从当前在线的玩家中检索对应的玩家对象

原型：func(String);

参数：String：字符串，要检索的玩家

player：玩家对象，要检查的玩家

返回值：Player，检索到的玩家

如果返回null，则无法检索到玩家

tpaHistory

本次加载后全服玩家的传送记录

原型：func();

返回值：Array[<Request>,..,<Request>]，包含本次加载后全服玩家的传送记录

tpaRequests

目前全服缓存的请求

原型：func();

返回值：Array[<Request>,..,<Request>]，包含目前全服缓存的请求

类

Request：

属性：

origin：Player，请求的发起者

target：Player，请求的接受者

type：String，可以是"tpa"或"tpahere"，请求的种类

time：int，请求的时间，以1970年1月1日以来的毫秒数计


注意，如果您是插件开发者，希望通过使玩家通过/tpa等指令调用本插件功能，请尽可能使用player.runcmd()，如果使用mc.runcmdEx("execute ...")，可能会出现失灵的情况。


[/hidden]
    -->
