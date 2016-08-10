# crossTab
PowerBI Custom Visual

The CrossTab could be called a Table Matrix but this control name already exists.
The CrossTab is based on the Adjacency Matrix by Mike Bostock - https://bost.ocks.org/mike/miserables/

You can load an X-Axis (Category), Y-Axis (Category) and a Values (Measure). (Optionally) the values can be displayed in the square and you can choose colours to display depending on the value. 

The 'Override Dimension' is a measure that should resolve to 0 or 1. If the value is 1, then the background color provided in 'Override Dimension Colour' will be used. This is useful if you want to override the background colour of certain squares to highlight values. In my example I use the Override Dimension if the particular square is 'Late'

![crossTab Gif](http://i.giphy.com/3o6ZsSjGhbf9ePxE0U.gif)

**Coming Soon**

2 Extra Override Dimensions
1 will add a border of the colour of your choosing the other will add a line on the right handside of the square.
