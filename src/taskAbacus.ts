/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
     //import ValueFormatter = powerbi.visuals.valueFormatter;

    export interface TaskAbacusDataPoint {
        categoryY: string;
        x:number;
        y:number;
        overrideDimension1: boolean;
        overrideDimension2: boolean;
        borderDimension: boolean;
        timelineDimension: boolean;
        value: number;
        identity: ISelectionId;
        fill: string;
        isTotal: boolean;
        selected: boolean;
        tooltipData:string;
    }

    export interface FieldIndex {
        rowIndex:number;
        rowSortOrderIndex:number;
        columnIndex:number;
        valueIndex:number;
        tooltipValueIndexes:[ToolTipValues];
    }

    export interface ToolTipValues {
        name:string;
        index:number;
    }

    export interface ISvgSize {
        width: number;
        height: number;
    }

    export interface TaskAbacusCategoryX {
      label: string;
      highlight: number;
    }

    export interface TaskAbacusCategoryY {
      label: string;
      highlight: number;
    }

    export class TaskAbacus implements IVisual {
        private static Properties: any = {
          general: {
              formatString: <DataViewObjectPropertyIdentifier>{
                  objectName: "general",
                  propertyName: "formatString"
              }
          },
          dataPoint: {
              defaultColor: <DataViewObjectPropertyIdentifier>{
                  objectName: 'dataPoint',
                  propertyName: 'defaultColor' },
              fill: <DataViewObjectPropertyIdentifier>{
                  objectName: 'dataPoint',
                  propertyName: 'fill'
              },
              value:<DataViewObjectPropertyIdentifier>{
                  objectName:'dataPoint',
                  propertyName:'value'
              }
          },
          labels: {
              labelPrecision: <DataViewObjectPropertyIdentifier>{
                  objectName: "labels",
                  propertyName: "labelPrecision"
              }
          }
        };

        private svg: d3.Selection<SVGElement>;
        private svgDiv: d3.Selection<SVGElement>;
        private svgSize: ISvgSize = { width: 800, height: 300 };
        private mainGraphics: d3.Selection<SVGElement>;
        private colors: IColorPalette;
        private host: IVisualHost;
        private selectionManager: ISelectionManager;
        private dataView: DataView;
        private dicColor = [];
        private totalXTitle = 'Total';
        private totalYTitle = 'Total';
        private totalsColor = '#5E5E5E';
        private YAxisHighlightColor = '#FFFFA3';
        private XAxisHighlightColor = '#FFFFA3';
        private overrideDimension1Color = '#FF6363';
        private overrideDimension2Color = '#FF6363';
        private borderDimensionColor = '#FF6363';
        private timelineDimensionColor = '#0033FF';
        private viewport: IViewport;
        //private margin: IMargin = { left: 10, right: 10, bottom: 15, top: 15 };
        private margin: any = { left: 10, right: 10, bottom: 15, top: 15 };
        private animationDuration: number = 1000;

        private dataViews: DataView[];
        private chartData: any;

         private tooltipServiceWrapper: ITooltipServiceWrapper;


        /*constructor(options: VisualConstructorOptions) {
            console.log('Visual constructor', options);
            this.target = options.element;
            this.updateCount = 0;
        }*/

        public static visualTransform(dataView: DataView, host: IVisualHost, showTotals:boolean, totalXTitle: string, totalYTitle: string): any {
            // no category - nothing to display
            if (!dataView
            || !dataView
            || !dataView.table
            || !dataView.table.rows
            || !dataView.table.rows[0].length)
                return { datapoints:null };

            var dataPoints: TaskAbacusDataPoint[] = [];
            var catY: TaskAbacusCategoryY[] = [];
            var currentCatY:string = null;
            var currentYCount:number = -1; // first should be 0
            var currentRowSortOrder:any = null;
            var firstSort:number = null;
            
            var yLength:number = 0;
            var xLength:number = 0;

            var k, id, categoryX, categoryY, values;
            var fieldIndex:FieldIndex = {
                rowIndex:null,
                rowSortOrderIndex:null,
                columnIndex:null,
                valueIndex:null,
                tooltipValueIndexes:[{
                    name:null,
                    index:null
                }]
            };


            //locate the index of each column
             for (var i:number = 0; i < dataView.table.columns.length; i++) {
                if (dataView.table.columns[i].roles['Columns']) {
                    fieldIndex.columnIndex = i;
                } else if (dataView.table.columns[i].roles['Rows']) {
                    fieldIndex.rowIndex = i;
                } else if (dataView.table.columns[i].roles['Values']) {
                    fieldIndex.valueIndex = i;
                } else if (dataView.table.columns[i].roles['RowSortOrder']) {
                    fieldIndex.rowSortOrderIndex = i;
                } else if (dataView.table.columns[i].roles['ToolTipData']) {
                    if (fieldIndex.tooltipValueIndexes[0].index === null) {
                        //work around, I don't know how to instantiate this object without something being in the array.. :(
                        fieldIndex.tooltipValueIndexes[0].name = dataView.table.columns[i].displayName;
                        fieldIndex.tooltipValueIndexes[0].index = i;
                    } else {
                        fieldIndex.tooltipValueIndexes.push({name:dataView.table.columns[i].displayName, index:i});
                    }
                    
                }
             }
            
            dataView.table.rows.sort(function(a, b) { 
                return a[fieldIndex.rowSortOrderIndex] > b[fieldIndex.rowSortOrderIndex] ? 1 : -1;
            });
            

             firstSort = <number>dataView.table.rows[0][fieldIndex.columnIndex]
            
             for (var i:number = 0; i < dataView.table.rows.length; i++) {
                 if (dataView.table.rows[i][fieldIndex.columnIndex] === firstSort) {
                    yLength ++;
                 } else {
                     break;
                 }
             }
             

             debugger;

            //fill Y-Axis
            for (var i:number = 0; i < dataView.table.rows.length; i++) {
                
                var xTotal:number = 0;
                var y:number = 0;
                var yAxis:string = dataView.table.rows[i][fieldIndex.rowIndex].toString();

                    //add Y Category
              //  if (currentCatY !== yAxis && dataView.table.rows[i][fieldIndex.columnIndex] === firstSort) {
               //     catY.push({label:yAxis, highlight: null});
              //      currentCatY = yAxis;
              //  }
                
                var columnNo:number = parseInt(<string>dataView.table.rows[i][fieldIndex.columnIndex]);
                if (columnNo > xLength) {
                    xLength = columnNo;
                    //currentYCount = 0; //also reset this
                }

                if (currentRowSortOrder !== dataView.table.rows[i][fieldIndex.rowSortOrderIndex]) {
                    //add new yAxis label to array
                    catY.push({label:yAxis, highlight: null});
                    //reset 
                    currentRowSortOrder = dataView.table.rows[i][fieldIndex.rowSortOrderIndex];
                    currentYCount++;
                }

                var ttd:string = null;
                if (fieldIndex.tooltipValueIndexes.length > 0) {
                    ttd =  <string>dataView.table.rows[i][fieldIndex.tooltipValueIndexes[0].index].toString()
                }
                
                dataPoints.push({
                    categoryY: yAxis,
                    x:columnNo - 1,
                    y:currentYCount,
                    overrideDimension1:false,
                    overrideDimension2:false,
                    borderDimension:false,
                    timelineDimension:false,
                    value: parseInt(<string>dataView.table.rows[i][fieldIndex.valueIndex]),
                    identity: null,//host.createSelectionIdBuilder().withCategory(dataView.categorical.categories[0], j).withSeries(dataView.categorical.values, dataView.categorical.values[i]).withMeasure(dataView.categorical.values[i].source.queryName).createSelectionId(),
                    fill:null,
                    isTotal:false,
                    selected:false,
                    tooltipData:ttd
                });

                /*if (currentYCount > yLength) {
                    currentYCount = 0;
                } else {
                    currentYCount ++;
                }*/
                
                
                //xTotal += datapoint.value;

                //add total datapoint at the end of the x-axis

               /* if (showTotals) {
                    dataPoints.push({
                        categoryY: yAxis,
                        x:j,
                        y:i,
                        overrideDimension1:false,
                        overrideDimension2:false,
                        borderDimension:false,
                        timelineDimension:false,
                        value: Math.round(xTotal / dataView.categorical.values[i].values.length),
                        identity: null,
                        fill:null,
                        isTotal:true,
                        selected:false
                    });
                }*/

        }  
              

            /*if (showTotals) {
              var rowCount:number = 0;
              for (var j:number = 0; j < dataView.categorical.values.length; j++) { // count number of rows; all types of values will be here so only count one type of values
                if (dataView.categorical.values[j].source.displayName === "TaskPercentComplete") {
                  rowCount++;
                }
              }

              for (var n:number = 0; n < dataView.categorical.values[0].values.length; n++) {  //this allows us to loop through all of the x-axis columns at the different levels in the arrays
                  var yTotal:number = 0;
                  for (var i:number = 0; i < dataView.categorical.values.length; i++) {
                    if (dataView.categorical.values[i].source.displayName === "TaskPercentComplete") {
                        yTotal += <number>dataView.categorical.values[i].values[n];
                      }
                  }

                  dataPoints.push({
                      categoryY: <string>totalYTitle,
                      x:j,
                      y:i,
                      overrideDimension1:false,
                      overrideDimension2:false,
                      borderDimension:false,
                      timelineDimension:false,
                      value: Math.round(yTotal / rowCount),
                      identity: null,
                      fill:null,
                      isTotal:true,
                      selected:false,
                      tooltipData:null
                  });
                }
            }

            if (showTotals) {
               // catX.push({label: totalXTitle, highlight: null});
                catY.push({label: totalYTitle, highlight: null});
            }
            */
            return {
                dataPoints: dataPoints,
                xLength:xLength,
                categoryY: catY.filter(function (n) { return n !== undefined; })
            };
        }


       constructor(options: VisualConstructorOptions) {

            this.host = options.host;

            this.svgSize.height = options.element.clientHeight;
            this.svgSize.width = options.element.clientWidth;

            this.svgDiv = d3.select(options.element)
                .append('div')
                .attr("style", "overflow: auto")
                .attr('class', 'crossTabContainer')
                .attr("style", 'height:' + this.svgSize.height)
                .attr("style", 'width:' + this.svgSize.width);

            this.svg = this.svgDiv
                .append('svg')
                .attr("class", "svgTaskAbacus")
                .attr("height", this.svgSize.height)
                .attr("width", this.svgSize.width);

            this.tooltipServiceWrapper = createTooltipServiceWrapper(this.host.tooltipService, options.element);
            this.selectionManager = options.host.createSelectionManager();
        }

        public update(options: VisualUpdateOptions): void {
            if (!options.dataViews || !options.dataViews[0]) return;
            this.svg.selectAll("*").remove();
            this.mainGraphics = this.svg;

            this.setViewportSize(options.viewport);
            this.updateInternal(options);

            this.tooltipServiceWrapper.addTooltip(this.svgDiv.selectAll('.dataPoint'), 
                (tooltipEvent: TooltipEventArgs<number>) => TaskAbacus.getTooltipData(tooltipEvent.data),
                (tooltipEvent: TooltipEventArgs<number>) => null);

            this.setSVGSize(options.viewport);
        }

        private updateInternal(options: VisualUpdateOptions): void {
            //debugger;
            var dataView = this.dataView = options.dataViews[0];
            var showTotals = this.getShowTotals(options.dataViews[0]);
            var totalXTitle = this.totalXTitle = this.getTotalXTitle(dataView);
            var totalYTitle = this.totalYTitle = this.getTotalYTitle(dataView);
            var totalsColor = this.totalsColor = this.getTotalsColor(dataView);
            var overrideDimension1Color = this.overrideDimension1Color = this.getOverrideDimension1Color(dataView);
            var overrideDimension2Color = this.overrideDimension2Color = this.getOverrideDimension2Color(dataView);
            var XAxisHighlightColor = this.XAxisHighlightColor = this.getXAxisHighlightColor(dataView);
            var YAxisHighlightColor = this.YAxisHighlightColor = this.getYAxisHighlightColor(dataView);
            var borderDimensionColor = this.borderDimensionColor = this.getBorderDimensionColor(dataView);
            var timelineDimensionColor = this.timelineDimensionColor = this.getTimelineDimensionColor(dataView);

            var chartData = this.chartData = TaskAbacus.visualTransform(dataView, this.host, showTotals, totalXTitle, totalYTitle);

            //var suppressAnimations = Boolean(options.suppressAnimations);
            debugger;
            if (chartData.dataPoints) {
                var minDataValue = d3.min(chartData.dataPoints, function (d: TaskAbacusDataPoint) { return d.value; });
                var maxDataValue = d3.max(chartData.dataPoints, function (d: TaskAbacusDataPoint) { return d.value; });

                //calculate the max length of the categoryX/Y columns as we cannot compute the width until after it's rendered
                var categoryXTextLength = 1, categoryYTextLength = 1, categoryXTextWidth = 10, categoryYTextWidth = 10;

                var showLegend = this.getShowLegend(dataView);
                var gridSizeWidth = 28, gridSizeHeight = 28;

                var legendElementWidth = gridSizeWidth;
                var legendElementHeight = gridSizeHeight / 2;

                var xOffset = gridSizeWidth + this.margin.left;
                var yOffset = this.margin.bottom;

                var dicColor = this.dicColor = [];
                this.getColors(dataView);

                // pre-set the order of elements
                //this.mainGraphics.append("g").attr("id", "XHighlight");
                //this.mainGraphics.append("g").attr("id", "YHighlight");
                //this.mainGraphics.append("g").attr("id", "XLabel");
                this.mainGraphics.append("g").attr("id", "YLabel");
                this.mainGraphics.append("g").attr("id", "dataPoint");

                this.mainGraphics.select("#YLabel")
                    .selectAll(".categoryYLabel")
                    .data(chartData.categoryY)
                    .enter().append("text")
                    .text(<any>function (d) {
                        return d.label;
                    })
                    .attr("dy", "1.1em")
                    //.attr("x", xOffset)
                    .attr("x", this.margin.left)
                    .attr("y", function (d, i) {
                        return  (i * gridSizeHeight + (yOffset) / 2.5) + categoryYTextWidth;
                     })
                    .style("text-anchor", "end")
                    .attr("transform", "translate(40," + gridSizeHeight + ")")
                    .attr("class", "categoryYLabel mono axis");

                //this.mainGraphics.selectAll(".categoryYLabel")
                //     .call(this.wrap, gridSizeWidth);

                this.mainGraphics.selectAll(".categoryYLabel")
                    .each(function() { categoryXTextWidth = Math.max(categoryXTextWidth, this.getComputedTextLength()); });


                //calculate categoryYTextWidth
                this.mainGraphics.selectAll(".categoryXLabel")
                    .each(function() { categoryYTextWidth = Math.max(categoryYTextWidth, this.getComputedTextLength()); });

                //re-apply categoryYTextWidth to CategoryYLabel
                this.mainGraphics.selectAll(".categoryYLabel")
                    .attr("y", function (d, i) {
                        return  (i * gridSizeHeight + (yOffset) / 2.5) + categoryYTextWidth;
                      })
                    .attr("transform", "translate(" + (categoryXTextWidth + 10) + "," + gridSizeHeight + ")")


                // add Y-Axis Highlight
                /*this.mainGraphics.select("#YHighlight")
                    .selectAll(".categoryYHighlight")
                    .data(chartData.categoryY)
                    .enter()
                    .append("rect")
                    .attr("x", 0)
                    .attr("y", <any>function(d, i) {
                      return yOffset + categoryYTextWidth + (i + 0.5) * gridSizeWidth;
                    })
                    .attr("width", categoryXTextWidth + gridSizeWidth)
                    .attr("height", gridSizeHeight)
                    .style("fill", <any>function(d, i) {
                      return d.highlight > 0 ? YAxisHighlightColor : "white";
                    })
                    .attr("startOffset","100%")
                    .attr("dy", "-.5em")
                    .attr("class", "categoryYHighlight mono axis");*/

                //we need to wait until we have computed the category axis text widths before setting the svg size:
                this.svgSize.width = (gridSizeWidth * (chartData.xLength)) + categoryXTextWidth;
                this.svgSize.height = (gridSizeHeight * (chartData.categoryY.length + 1)) + categoryYTextWidth;
                if (showLegend)
                {
                    this.svgSize.height += gridSizeHeight + yOffset * 2;
                }

                var selectionManager = this.selectionManager;

                var crosstab = this.mainGraphics.select("#dataPoint")
                    .selectAll(".dataPoint")
                    .data(chartData.dataPoints)
                    .enter()
                    .append("rect")
                    .attr("x", function (d:TaskAbacusDataPoint, i) { 
                        var date1:Date = new Date();
                        var timestamp:number = date1.getTime();
                        //console.log('x:' + d.x + ' returnX:' + (d.x * gridSizeWidth + xOffset + (categoryXTextWidth - 10)));
                        //console.log('y:' + d.y + ' returnY:' + (((d.y + 0.5) * gridSizeHeight + yOffset) + categoryYTextWidth) + ' dateStamp:' + timestamp)
                        return d.x * gridSizeWidth + xOffset + (categoryXTextWidth - 10); 
                    })
                    .attr("y", function (d:TaskAbacusDataPoint, i) { return ((d.y + 0.5) * gridSizeHeight + yOffset) + categoryYTextWidth; })
                    .attr("class", "dataPoint bordered")
                    .attr("width", gridSizeWidth - 1)
                    .attr("height", gridSizeHeight - 1)
                    .attr("rx", 4)
                    .attr("ry", 4)
                    .style("stroke", function (d:TaskAbacusDataPoint, i) {
                        return d.borderDimension == true ? borderDimensionColor : 'White';
                    })
                    .style("stroke-width", 1)
                    .style("fill", '#E8E8E8');


                var currentX = 0, currentY = 0;
                var crosstab3 = this.mainGraphics.selectAll(".timelineDimension")
                    .data(chartData.dataPoints)
                    .enter()
                    .append("line")
                    .attr("visibility", function (d:TaskAbacusDataPoint, i) {
                        return d.timelineDimension == true ? "visible" : "hidden";
                    })
                    .style("stroke", function(d:TaskAbacusDataPoint, i) { return timelineDimensionColor })  // colour the line
                    .attr("stroke-width", function(d:TaskAbacusDataPoint, i) { return 4})
                    .attr("x1", function (d:TaskAbacusDataPoint, i) { return ((d.x * gridSizeWidth + xOffset) + (categoryXTextWidth - 10)) + 28; })     // x position of the first end of the line
                    .attr("y1", function (d:TaskAbacusDataPoint, i) { return ((d.y + 0.5) * gridSizeHeight + yOffset) + categoryYTextWidth; })      // y position of the first end of the line
                    .attr("x2", function (d:TaskAbacusDataPoint, i) { return ((d.x * gridSizeWidth + xOffset) + (categoryXTextWidth - 10)) + 28; })     // x position of the second end of the line
                    .attr("y2", function (d:TaskAbacusDataPoint, i) { return (((d.y + 0.5) * gridSizeHeight + yOffset) + categoryYTextWidth) + 28; });

                    d3.selectAll("line[visibility=hidden]").remove();

                var getColor = function (val, isTotal:boolean, overrideDimension1:boolean, overrideDimension2:boolean, borderDimension:boolean, timelineDimension:boolean) {
                      if (overrideDimension1) {
                          return overrideDimension1Color;
                      } else if (overrideDimension2) {
                          return overrideDimension2Color;
                      } else if (isTotal) {
                          return totalsColor;
                      } else if (dicColor[val]) {
                          return dicColor[val].solid.color;
                      } else {
                          return '#E8E8E8';
                          // return '#FFFFFF';
                      }
                };

                var elementAnimation: any = this.getAnimationMode(crosstab, true);
                elementAnimation.style("fill", function (d) { return getColor(d.value, d.isTotal, d.overrideDimension1, d.overrideDimension2, d.borderDimension, d.timelineDimension) });

                var crosstab1 = this.mainGraphics.selectAll(".dataPoint")
                .on('mouseover', function (d:TaskAbacusDataPoint) {
                    d3.select(this).transition()
                        .ease("elastic")
                        .duration(1000)
                        .attr("rx", 8)
                        .attr('ry', 8);


                    //mouseover(null, d.categoryY);
                    (<Event>d3.event).stopPropagation();
                })
                .on('mouseout', function (d:TaskAbacusDataPoint) {
                    d3.select(this).transition()
                        .ease("elastic")
                        .duration(1000)
                        .attr("rx", 4)
                        .attr('ry', 4)
                    mouseout();
                    (<Event>d3.event).stopPropagation();
                })
                .on('click', function (d:TaskAbacusDataPoint) {
                    if (d.selected && !d.isTotal) { // ignore total cells
                        d3.selectAll(".dataPoint").style('opacity', 1);
                        d.selected = false;
                        selectionManager.clear();
                    } else if (!d.selected && !d.isTotal) {
                        d3.selectAll(".dataPoint").style('opacity', 0.6);
                        selectionManager.select(d.identity).then(ids => d3.select(this).style('opacity', 1));
                        d.selected = true;
                    }
                    (<Event>d3.event).stopPropagation();
                })

                var mouseover = function (categoryX, categoryY) {
                    d3.selectAll(".categoryXLabel").classed("active", function(d, i) { return d.label == categoryX });
                    d3.selectAll(".categoryYLabel").classed("active", function(d, i) { return d.label == categoryY });
                  };

                var mouseout = function () {
                    d3.selectAll("text").classed("active", false);
                  };

                var showDataInRect = this.getShowData(dataView);


                if (showDataInRect) {
                    this.mainGraphics.selectAll(".rectValue")
                        .data(chartData.dataPoints)
                        .enter()
                        .append("text")
                        .attr("x", function (d:TaskAbacusDataPoint, i) { return d.x * gridSizeWidth + xOffset + (categoryXTextWidth - 25); })
                        .attr("y", function (d:TaskAbacusDataPoint, i) { return ((d.y + 0.75) * gridSizeHeight + yOffset) + categoryYTextWidth - 2; })
                        .attr("dy", "1.81em")
                        .style("text-anchor", "middle")
                        .style("fill", "#1E6F8A")
                        .attr("class", "rectValue mono axis bar-text")
                        .attr("transform", "translate(" + gridSizeHeight + ", -6)")
                        .text(<any>function (d) {                       
                            if (d.value !== null) {
                                return d.value.toString();//.substring(0,1)
                            } else {
                                return null;
                            }
                        });
                }
                else {
                    crosstab.append("title").text(<any>function (d) {
                       //return valueFormatter.create({ value: Number(d.value) }).format(Number(d.value));
                    });
                }


                var showLegend = this.getShowLegend(dataView);

                if (showLegend) {
                   /*var legend = this.mainGraphics.selectAll(".legend")
                        .data([0].concat(colorScale.quantiles()), function (d) { return d; });

                    legend.enter().append("g")
                        .attr("class", "legend");

                    var legendOffsetX = xOffset;
                    var legendOffsetCellsY = yOffset * 2 + gridSizeHeight * (chartData.categoryY.length + 1) + categoryYTextWidth;
                    var legendOffsetTextY = yOffset * 2 + gridSizeHeight * (chartData.categoryY.length + 1) + legendElementHeight * 2 + categoryYTextWidth;

                    legend.append("rect")
                        .attr("x", function (d, i) { return legendElementWidth * i + legendOffsetX; })
                        .attr("y", legendOffsetCellsY)
                        .attr("width", legendElementWidth)
                        .attr("height", legendElementHeight)
                        .style("fill", function (d, i) { return colors[i]; })
                        .attr("class", "bordered");

                    legend.append("text")
                        .attr("class", "mono")
                        .attr("x", function (d, i) { return legendElementWidth * i + legendOffsetX - legendElementWidth / 4; })
                        .attr("y", legendOffsetTextY)
                        .text(function (d) {
                            return valueFormatter.create({ value: d }).format(d);
                        });
                    this.mainGraphics.select(".legend")
                        .data([0].concat(maxDataValue))
                        .attr("class", "legend")
                        .append("text")
                        .attr("class", "mono")
                        .text(valueFormatter.create({ value: Number(maxDataValue) }).format(Number(maxDataValue)))
                        .attr("x", legendElementWidth * colors.length + legendOffsetX - legendElementWidth / 4)
                        .attr("y", legendOffsetTextY);

                    legend.exit().remove();*/
                }
            } else if (chartData.categoryY) {
                this.mainGraphics.append("g").attr("id", "YLabel");
                this.mainGraphics.select("#YLabel")
                    .selectAll(".categoryYLabel")
                    .data(chartData.categoryY)
                    .enter().append("text")
                    .text(<any>function (d) {
                        return d.label;
                    })
                    .attr("dy", "1.1em")
                    //.attr("x", xOffset)
                    .attr("x", this.margin.left)
                    .attr("y", function (d, i) {
                        return  (i * gridSizeHeight + (yOffset) / 2.5) + categoryYTextWidth;
                     })
                    .style("text-anchor", "end")
                    .attr("transform", "translate(40," + gridSizeHeight + ")")
                    .attr("class", "categoryYLabel mono axis");
            }
        }


        /*public getColor(val) :string {
            if(val) {
                if (val < 5) {
                    return 'Blue';
                } else if (val < 10) {
                    return 'Orange';
                } else if (val < 20) {
                    return 'Red';
                }
            }
            return '#000';
        }*/

        private static getTooltipData(value: any): VisualTooltipDataItem[] {
            var val = value.value.toString();
            if (val.length > 0) {
                val += '%';
            }
             return [{
                 displayName: null,
                 value: value.categoryY.toString(),
                 color: value.color
             },
             {
                 displayName: 'Task',
                 value: value.tooltipData.toString(),
                 color: value.color
             },
             {
                 displayName: '% Complete',
                 value: val,
                 color: value.color
             },
             {
                 displayName: 'X',
                 value: value.x.toString(),
                 color: value.color
             },
             {
                 displayName: 'Y',
                 value: value.y.toString(),
                 color: value.color
             }];
         }

        private setViewportSize(viewport: IViewport): void {
            var height: number,
                width: number;

            height =
                viewport.height -
                this.margin.top -
                this.margin.bottom;

            width =
                viewport.width -
                this.margin.left -
                this.margin.right;

            this.viewport = {
                height: height,
                width: width
            };

            this.mainGraphics
                .attr("height", Math.max(this.viewport.height + this.margin.top, 0))
                .attr("width", Math.max(this.viewport.width + this.margin.left, 0));

            //this.mainGraphics.attr("transform", SVGUtil.translate(this.margin.left, this.margin.top));
        }

        private setSVGSize(viewport: IViewport): void {
            this.svg
                .attr("height", this.svgSize.height)
                .attr("width", this.svgSize.width);

            this.svgDiv
                //.attr("style", "overflow: auto; height:" + this.svgSize.height + "px; width:" + this.svgSize.width + "px;");
                .attr("style", "overflow: auto; height:" + viewport.height + "px; width:" + viewport.width + "px;");
        }

        private truncateTextIfNeeded(text: d3.Selection<SVGElement>, width: number): void {
            /*text.call(AxisHelper.LabelLayoutStrategy.clip,
                width,
                TextMeasurementService.svgEllipsis);*/
        }

        /*private wrap(text, width): void {
            text.each(function () {
                var text = d3.select(this);
                var words = text.text().split(/\s+/).reverse();
                var word;
                var line = [];
                var lineNumber = 0;
                var lineHeight = 1.1; // ems
                var x = text.attr("x");
                var y = text.attr("y");
                var dy = parseFloat(text.attr("dy"));
                var tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    var tspannode: any = tspan.node();  //Fixing Typescript error: Property 'getComputedTextLength' does not exist on type 'Element'.
                    if (tspannode.getComputedTextLength() > width) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
        }*/


        private getAnimationMode(element:any, suppressAnimations: boolean): any {
            if (suppressAnimations) {
                return element;
            }

            return element.transition().duration(this.animationDuration);
        }




        private getColors(dataView: DataView): void {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        for (var i = 0; i <= 10; i++) {
                           if (general['color' + i] && general['color' + i + 'Val']) {
                                this.dicColor[<string>general['color' + i + 'Val']] = general['color' + i];
                           }
                        }
                    }
                }
            }
        }

        private getColor(dataView: DataView, colorNum: string): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['color' + colorNum]) {
                           return <string>general['color' + colorNum];
                       }
                    }
                }
            }
            return null;
        }

        private getTotalsColor(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['totalsColor']) {
                           //return general['totalsColor'].solid.color;
                           return <string>general['totalsColor'];
                       }
                    }
                }
            }
            return '#5E5E5E';
        }

        private getOverrideDimension1Color(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['overrideDimension1Color']) {
                           //return general['overrideDimension1Color'].solid.color;
                           return <string>general['overrideDimension1Color'];
                       }
                    }
                }
            }
            return '#FF6363';
        }

        private getOverrideDimension2Color(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['overrideDimension2Color']) {
                           //return general['overrideDimension2Color'].solid.color;
                           return <string>general['overrideDimension2Color'];
                       }
                    }
                }
            }
            return '#FF6363';
        }

        private getXAxisHighlightColor(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['XAxisHighlightColor']) {
                           //return general['XAxisHighlightColor'].solid.color;
                           return <string>general['XAxisHighlightColor'];
                       }
                    }
                }
            }
            return '#FFFFA3';
        }

        private getYAxisHighlightColor(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['YAxisHighlightColor']) {
                           //return general['YAxisHighlightColor'].solid.color;
                           return <string>general['YAxisHighlightColor'];
                       }
                    }
                }
            }
            return '#FFFFA3';
        }

        private getBorderDimensionColor(dataView: DataView): string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['borderDimensionColor']) {
                           //return general['borderDimensionColor'].solid.color;
                           return <string>general['borderDimensionColor'];
                       }
                    }
                }
            }
            return '#FF6363';
        }

        private getTimelineDimensionColor(dataView:DataView):string {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['timelineDimensionColor']) {
                           //return general['timelineDimensionColor'].solid.color;
                           return <string>general['timelineDimensionColor'];
                       }
                    }
                }
            }
            return '#FF6363';
        }

        private getColorVal(dataView: DataView, colorNum: string): number {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['color' + colorNum + 'Val']) {
                           return <number>general['color' + colorNum + 'Val'];
                       }
                    }
                }
            }
            return null;
        }

        private getLegendVal(dataView: DataView, colorNum: string): number {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['color' + colorNum + 'LegendVal']) {
                           return <number>general['color' + colorNum + 'LegendVal'];
                       }
                    }
                }
            }
            return null;
        }

        private getShowData(dataView: DataView): boolean {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        return <boolean>general['showData'];
                    }
                }
            }
            return false;
        }

        private getShowLegend(dataView: DataView): boolean {

           if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        return <boolean>general['showLegend'];
                    }
                }
            }
            return false;
        }

        private getShowTotals(dataView: DataView): boolean {

           if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        return <boolean>general['showTotals'];
                    }
                }
            }
            return false;
        }

        private getTotalXTitle(dataView: DataView): string {

           if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        return <string>general['totalXTitle'];
                    }
                }
            }
            return 'Total';
        }

        private getTotalYTitle(dataView: DataView): string {

           if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                        return <string>general['totalYTitle'];
                    }
                }
            }
            return 'Total';
        }

        public static getLengthOfObject(object: any):number {
            var length = 0;
            for( var key in object ) {
                if( object.hasOwnProperty(key) ) {
                    ++length;
                }
            }
            return length;
        }

       public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
            var instances: VisualObjectInstance[] = [];
            var dataView = this.dataView;
            var objectName = options.objectName;

            switch (options.objectName) {
                case 'general':
                    instances.push({
                        objectName: 'general',
                        displayName: 'General',
                        selector: null,
                        properties: {
                            color1:this.getColor(dataView, '1'),
                            color1Val:this.getColorVal(dataView, '1'),
                            //color1LegendVal:this.getLegendVal(dataView, '1'),
                            color2:this.getColor(dataView, '2'),
                            color2Val:this.getColorVal(dataView, '2'),
                            //color2LegendVal:this.getLegendVal(dataView, '2'),
                            color3:this.getColor(dataView, '3'),
                            color3Val:this.getColorVal(dataView, '3'),
                            //color3LegendVal:this.getLegendVal(dataView, '3'),
                            color4:this.getColor(dataView, '4'),
                            color4Val:this.getColorVal(dataView, '4'),
                            //color4LegendVal:this.getLegendVal(dataView, '4'),
                            color5:this.getColor(dataView, '5'),
                            color5Val:this.getColorVal(dataView, '5'),
                            //color5LegendVal:this.getLegendVal(dataView, '5'),
                            color6:this.getColor(dataView, '6'),
                            color6Val:this.getColorVal(dataView, '6'),
                            color7:this.getColor(dataView, '7'),
                            color7Val:this.getColorVal(dataView, '7'),
                            color8:this.getColor(dataView, '8'),
                            color8Val:this.getColorVal(dataView, '8'),
                            color9:this.getColor(dataView, '9'),
                            color9Val:this.getColorVal(dataView, '9'),
                            color10:this.getColor(dataView, '10'),
                            color10Val:this.getColorVal(dataView, '10'),
                            XAxisHighlightColor:this.getXAxisHighlightColor(dataView),
                            YAxisHighlightColor:this.getYAxisHighlightColor(dataView),
                            overrideDimension1Color:this.getOverrideDimension1Color(dataView),
                            overrideDimension2Color:this.getOverrideDimension2Color(dataView),
                            borderDimensionColor:this.getBorderDimensionColor(dataView),
                            timelineDimensionColor:this.getTimelineDimensionColor(dataView),
                            showData: this.getShowData(dataView),
                            // showLegend: this.getShowLegend(dataView),
                            showTotals: this.getShowTotals(dataView),
                            totalXTitle: this.getTotalXTitle(dataView),
                            totalYTitle: this.getTotalYTitle(dataView),
                            totalsColor: this.getTotalsColor(dataView)
                        }
                    });
                    break;
                 case 'dataPoint':
                    if (this.dataView /*&& !GradientUtils.hasGradientRole(this.dataView.categorical)*/)
                        this.enumerateDataPoints(instances, options);
                    break;
            }
             return instances;
        }

        private enumerateDataPoints(instances: VisualObjectInstance[], options: EnumerateVisualObjectInstancesOptions): void {
            var data = this.chartData;
                if (!data)
                    return;
                var dicInstanceValues = [];
                var seriesCount = data.dataPoints.length;
                    /*enumeration.pushInstance({
                        objectName: 'dataPoint',
                        selector: null,
                        properties: {
                            defaultColor: { solid: { color: data.defaultDataPointColor || this.colors.getColorByIndex(0).value } }
                        }
                    }).pushInstance({
                        objectName: 'dataPoint',
                        selector: null,
                        properties: {
                            showAllDataPoints: !!data.showAllDataPoints
                        }
                    });
                    for (var i = 0; i < seriesCount; i++) {
                        var seriesDataPoints = data.dataPoints[i];
                        if (seriesDataPoints.value !== undefined || seriesDataPoints.value !== null) {
                            if (!(this.dicColor[seriesDataPoints.value])) {
                                //add it to colors
                                this.dicColor[seriesDataPoints.value] = (seriesDataPoints.fill) ? seriesDataPoints.fill : '#E8E8E8';
                            }

                            if (!(dicInstanceValues[seriesDataPoints.value])) {
                                instances.push({
                                    objectName: 'dataPoint',
                                    displayName: seriesDataPoints.value.toString(),
                                    selector: visuals.ColorHelper.normalizeSelector(seriesDataPoints.identity.getSelector()),
                                    properties: {
                                        fill: { solid: { color: seriesDataPoints.fill } }
                                    },
                                });
                                dicInstanceValues[seriesDataPoints.value] = seriesDataPoints.fill;
                            }


                        }

                    }*/
        }
    }
}
