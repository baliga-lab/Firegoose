function onLoad() {
	var params = window.arguments[0];
	document.getElementById("message").value = params.inn.message;
	
	document.setProgress = function(value) {
		this.getElementById("progress").value = value;
	};
}