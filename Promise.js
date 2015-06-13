(function(module){

	var _Promise = window.Promise;

	//Promise构造器
	//@parmas fn(resolve,reject) 
	//	创建Promise时传入的业务函数，一般包含一个异步操作，回调时改变Promise状态
	//  Promise提供两个函数resolve和reject用于改动Promise状态和数值
	//如下所示:
	// var p = new Promise(function(resolve, reject){
	// 	$.ajax({
	// 		url:'xxx', 
	// 		success: function(response){
	// 			resolve(response);
	// 		},
	// 		error: function(request, textStatus, thrown){
	// 			reject(textStatus);
	// 		}
	// 	});
	// })
	var Promise = function(fn){
		//Promise状态
		this.state = 'pending';
		//resolve时的返回值，传给then中的success函数
		this.value;
		//reject时的返回值，传给then中的error函数
		this.reson;
		//当前Promise对应的一个classbacks,这里记录then中的success,error回调和连接下一个
		this.callback = {isDispatch:false};
		//调用业务函数，传入resolve和reject方法实现异步变更Promise状态
		if(typeof fn == 'function'){
			fn.call(null, this.resolve.bind(this), this.reject.bind(this));
		}
	};
	//将Promise状态变为fulfilled,传入数据,并触发对应的回调函数
	//一般在异步数据到达时调用
	Promise.prototype.resolve = function(value){
		if(this.state != 'pending')return;
		this.state = 'fulfilled';
		this.value = value;
		//事件分发
		this._dispatch();
		return;
	}
	//将Promise状态变为rejected，传入原因（错误信息），并触发对应的回调函数
	//发生错误时调用
	Promise.prototype.reject = function(reason){
		if(this.state != 'pending')return;
		this.state = 'rejected';
		this.reason = reason;
		//事件分发
		this._dispatch();
		return;
	}
	//Promise主要接口，用于注册Promise状态改动后的回调函数
	//@params onFulfilled(value) 成功回调
	//@params onRejected(reson) 失败回调
	//@return Promise then操作后立即返回一个新的promise对象,实现Promise的链式操作
	Promise.prototype.then = function(onFulfilled, onRejectd){
		if(typeof onFulfilled == 'function'){
			this.callback.fulfill = onFulfilled;
		}
		if(typeof onRejectd == 'function'){
			this.callback.reject = onRejectd;
		}
		//如果当前Promsie处于结束状态，then操作后立即执行一次事件分开，让回调执行
		if(this.state != 'pending'){
			setTimeout(function(){
				this._dispatch();
			}.bind(this), 10);
		}
		//创建一个新的Promise，通过callback对象记录的下一个Promise引用
		this.callback.promise = new Promise();
		//返回新的Promise
		return this.callback.promise;
	}
	//Promise主要接口，用于注册Promise失败后的回调函数
	Promise.prototype.catch = function(onRejectd){
		//简单调用then操作完成事件注册
		//@notice 这里同样要返回一个新的Promise对象
		return this.then(null, onRejectd);
	}

	//Promise内部事件分析，按照Promise状态调用callback
	//根据callback返回值，触发下一个Promise
	Promise.prototype._dispatch = function(){
		if(this.state == 'pending') return;

		if(!this.callback.isDispatch){
			//回调未触发
			var callback = this.callback;
			var nextPromise = callback.promise;
			var returnVal;
			callback.isDispatch = true;
			try {
				switch(this.state){
					case 'fulfilled':
						if(callback.fulfill){
							//当前Promise有成功回调
							returnVal = callback.fulfill(this.value);
						} else {
							//当前Promise无成功回调，触发Promise链中的下一个
							nextPromise.resolve(this.value);
							return;
						}
						break;
					case 'rejected':
						if(callback.reject){
							//当前Promise有失败回调
							returnVal = callback.reject(this.reason);
						} else {
							//当前Promise无失败回调，触发Promise链中的下一个
							nextPromise.reject(this.reason);
							return;
						}
						break;
				}
				//当前Promise的回调调用后，根据其返回值触发Promise链中的下一个
				if(returnVal == null){
					//回调无返回，直接触发下一个Promise的fulfilled状态
					nextPromise.resolve(returnVal);
				} else if(returnVal instanceof Promise || typeof returnVal.then === 'function'){
					//回调返回一个Promise对象，值得注意的是
					//这个Promise对象并不在原Promise链中,而是一个全新的Promise
					//但我们希望这个新的Promise代替我们Promise链中的下一个Promise
					//这里的逻辑是可以稍微解释一下的：
					//	 new Promise(F0).then(F1).then(F2);
					//因为then方法会创建并返回Promise对象,
					//所以上面的代码创建了三个promise并且连成一个Promise链
					//当第一个Promise触发后，F1会被调用，如果F1返回一个Promise对象
					//那么逻辑上这个Promise应该是控制后面的Promise链，需要做一个转接
					//简单的方法是，当这个新的Promise触发后，我们相应调用原Promise链
					//中下一个Promise的resolve,reject方法。
					returnVal.then(nextPromise.resolve.bind(nextPromise), nextPromise.reject.bind(nextPromise));
				} else {
					//回调返回的是其他数据，直接传给下一个Promise
					nextPromise.resolve(returnVal);
				}
			} catch(e){
				//执行过程中如果出错，直接抛给下一个Promise
				nextPromise.reject(e);
			}
		}
	}
	module.Promise = Promise;
	module._Promise = _Promise;
})(window);