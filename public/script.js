var open = document.querySelector(".open");
var overlay = document.querySelector(".overlay");
var close = document.querySelector(".close");

open.addEventListener("click", function(){
  overlay.classList.add("visible");
})

close.addEventListener("click", function(){
  overlay.classList.remove("visible");
})
