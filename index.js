let got = require('got');
let Parse = require('./parse');

(async function() {
  /* 
  ** 登录获取token
  */
  let result;
  try {
    result = await got.get('https://ecard.95505.cn/front/login.do?fxGuid=d1bc4bf008b211e9922b7cd30ad3a7f8');
  } catch (error) {
		return console.error("​}catch -> error", error);
  }
  let user = JSON.parse(result.body).result;

  /*
  ** 获取最近的订单
  */
  let orderList;
  try {
    orderList = await got('https://ecard.95505.cn/api/myEcard/getOrders.do', {
      headers: {
        authorization: user.authorizationToken,
      },
      query: {
        userId: user.userId,
        userType: user.userType,
        orderType: 2
      }
    })
  } catch (error) {
		return console.error("​}catch -> error", error);
  }
  let list = JSON.parse(orderList.body).result;

  /*
  ** 获取已保存的订单
  */
  let policyList;
  try {
    policyList = await (new Parse.Query('Policy').select('insuranceNo')).find({
      useMasterKey: true
    })
  } catch (error) {
    console.error("​}catch -> error", error)
  }
  let insuranceNoSet = new Set(policyList.map((item) => item.get('insuranceNo')));

  /*
  ** 过滤需要添加的订单
  */
  let forSaveInsurance = list.filter((item) => !insuranceNoSet.has(item.policyNo));

  if (forSaveInsurance.length === 0) {
    console.log("​status: 暂无相关信息更新");
    return;
  }

  /*
  ** 格式化需要保存的订单
  */
  let saveQueue = await forSaveInsurance.reduce(async(queue, item) => {
    let insuranceName = item.productName;
    let insuranceResult;
    try {
      insuranceResult = await (new Parse.Query('Insurance').contains('name', insuranceName)).find({
        useMasterKey: true
      });
    } catch (error) {
			console.error("​}catch -> error", error);
    }
    let policy = new Parse.Object('Policy', {
      amount: item.premium + '',
      insuranceNo: item.policyNo,
      phone: item.applicantMobile,
      name: item.applicantName,
      ACL: {},
      LEGO_STATUS : "",
      LEGO_PUBLISH_TAGS: ["online"],
    });
    if (insuranceResult && insuranceResult.length > 0) {
      policy.set('insurance', insuranceResult[0].toPointer());
      queue.push(policy);
      return queue;
    }
    let insurance = await (new Parse.Object('Insurance')).save({
      name: insuranceName,
      LEGO_STATUS: '',
      LEGO_PUBLISH_TAGS: ['online'],
    }, {
      useMasterKey: true,
    })

    policy.set('insurance', insurance.toPointer());
    queue.push(policy);
    return queue;
  }, [])

  /* 
  ** 保存更新的订单
  */
  let status;
  try {
    status = await Parse.Object.saveAll(saveQueue, {
      useMasterKey: true
    });
  } catch (error) {
		console.error("​}catch -> error", error);
  }

	console.log(`status: 已成功添加${status.length}条信息`);
})()