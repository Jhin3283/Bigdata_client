$(document).ready(function () {
  // set the image-map width and height to match the img size
  $("#image-map").css({
    width: $("#image-map img").width(),
    height: $("#image-map img").height(),
  });

  //tooltip direction
  var pintooltipDirection;

  for (i = 0; i < $(".pin").length; i++) {
    // set tooltip direction type - up or down
    if ($(".pin").eq(i).hasClass("pin-down")) {
      pintooltipDirection = "pintooltip-down";
    } else {
      pintooltipDirection = "pintooltip-up";
    }

    // append the tooltip
    $("#image-map").append(
      "<div style='left:" +
        $(".pin").eq(i).data("xpos") +
        "px;top:" +
        $(".pin").eq(i).data("ypos") +
        "px' class='" +
        pintooltipDirection +
        "'>\
                                            <div class='pintooltip'>" +
        $(".pin").eq(i).html() +
        "</div>\
                                    </div>"
    );
  }

  // show/hide the tooltip
  $(".pintooltip-up, .pintooltip-down")
    .mouseenter(function () {
      $(this).children(".pintooltip").fadeIn(100);
    })
    .mouseleave(function () {
      $(this).children(".pintooltip").fadeOut(100);
    });
});
