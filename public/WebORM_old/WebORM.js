function registerHandlers()
{
    var list = document.getElementsByClassName("ORMInput");
    
    for(i = 0; i < list.length; i++)
    {
        console.log("adding event to " + list[i].getAttribute("class"));
        list[i].addEventListener("click", updateORMColors, false);
    }
}

function updateORMColors(event)
{
    console.log("asdf");
    
    var list = document.getElementsByClassName("ORMRow");
    
    for(i = 0; i < list.length; i++)
    {
        list[i].className = list[i].className + " danger";
    }
}