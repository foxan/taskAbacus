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

module powerbi.extensibility.visual.PBI_CV_522F2011_DD5A_44D2_A8ED_456F3931DF77  {
     //import ValueFormatter = powerbi.visuals.valueFormatter;


    export interface CrossTabDataPoint {
        categoryX: string;
        categoryY: string;
        value: number;
        valueStr: string;
        identity: number;
        fill:string,
        isTotal:boolean
    }
    export interface ISvgSize {
        width: number;
        height: number;
    }


    export class CrossTab implements IVisual {
        private target: HTMLElement;
        private updateCount: number;

         private static Properties: any = {
            general: {
                /*formatString: <DataViewObjectPropertyIdentifier>{
                    objectName: "general",
                    propertyName: "formatString"
                }*/
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
        private colors: IDataColorPalette;
        private selectionManager: ISelectionManager;
        private dataView: DataView;
        private dicColor = [];
        private viewport: IViewport;
        //private margin: IMargin = { left: 10, right: 10, bottom: 15, top: 15 };
        private margin: any = { left: 10, right: 10, bottom: 15, top: 15 };
        private animationDuration: number = 1000;
        
        private dataViews: DataView[];
        private chartData: any;


        /*constructor(options: VisualConstructorOptions) {
            console.log('Visual constructor', options);
            this.target = options.element;
            this.updateCount = 0;
        }*/

        public static converter(dataView: DataView, dicColors : any /*colors: IDataColorPalette*/, showTotals:boolean): any {
            // no category - nothing to display
            if (!dataView ||
                !dataView.categorical ||
                !dataView.categorical.categories ||
                !dataView.categorical.categories[0] ||
                !dataView.categorical.categories[0].values ||
                !dataView.categorical.categories[0].values.length) {
                return {
                    dataPoints: null
                };
            }
            // no values - nothing to display
            if (!dataView.categorical.values ||
                !dataView.categorical.values[0] ||
                !dataView.categorical.values[0].values ||
                !dataView.categorical.values[0].values.length) {
                return {
                    dataPoints: null
                };
            }

            //var categoryValueFormatter: IValueFormatter;	
            //var legendValueFormatter: IValueFormatter;
            var dataPoints: CrossTabDataPoint[] = [];
            var catMetaData = dataView.metadata;
            var catTable = dataView.table;
            var catX: string[] = [];
            var catY: string[] = [];

            var data: CrossTabDataPoint[];
            var k, id, categoryX, categoryY, values;

            //var formatStringProp = CrossTab.Properties.general.formatString;
            
            var dataViewMetadata: DataViewMetadata = dataView.metadata;
            
            //this calculates the totals on the bottom Totals row, which is added at the end (see below)

            var totalsCol = [];
            if (showTotals) {
                for (var n:number = 1; n < dataView.table.columns.length; n++) {
                    var total = 0;
                    for (var m:number = 0; m < dataView.table.rows.length; m++) {
                            if (dataView.table.rows[m][n] && typeof dataView.table.rows[m][n] !== 'object') {
                                total += dataView.table.rows[m][n];
                            }
                    }
                    if (total && dataView.table.rows.length > 0) {
                        totalsCol.push({
                            categoryX:dataView.metadata.columns[n].displayName,
                            value:Math.round(total / dataView.table.rows.length)
                        });
                    } else {
                        totalsCol.push({
                            categoryX:dataView.metadata.columns[n].displayName,
                            value:null
                        });
                    }
                    
                }
            }
            

            //create standard datapoints
            for (var i in dataView.table.rows) {
                data = [];
                values = []; k = 0;
                for (var j in dataView.table.columns) {
                    //id = SelectionId.createWithId(dataView.categorical.categories[0].identity[0]);
                    
                    if (!catMetaData.columns[j].isMeasure) {
                        categoryY = catY[i] = catTable.rows[i][j];
                    }
                    if (catMetaData.columns[j].isMeasure) {
                        var value = catTable.rows[i][j];
                        var valueStr;
                        if (value !== undefined) {
                            categoryX = catX[j] = catMetaData.columns[j].displayName;
                            if (catMetaData.columns[j].groupName) {
                                categoryX += ": " + catMetaData.columns[j].groupName;
                                catY[j] += ": " + catMetaData.columns[j].groupName;
                            }
                        }
                        values[k] = { value: value, valueStr: valueStr, category: categoryX, fill:null };
                        k++;
                    }
                }
               
                values.forEach(function (element) {
                    dataPoints.push({
                        categoryY: categoryY,
                        categoryX: element.category,
                        value: element.value,
                        valueStr: element.valueStr,
                        identity: id,
                        fill:element.fill,
                        isTotal:false
                    });
                }, this);


                if (showTotals) {
                    //For totals (average) at the end of each row 
                    var total = 0;
                    for (var l in values) {
                        if (values[l].value) {
                            total += values[l].value;
                        }                    
                    }
                    //add values for end of each row to this rows set of datapoints
                    dataPoints.push({
                        categoryY: categoryY,
                        categoryX: 'Total',
                        value: Math.round(total / values.length),
                        valueStr: null,
                        identity: null,
                        fill:null,
                        isTotal:true
                    });
                }
                 
            }

            if (showTotals) {
                //add totals row
                totalsCol.forEach(function(element) {
                        dataPoints.push({
                            categoryY:'Total',
                            categoryX:element.categoryX,
                            value:element.value,
                            valueStr:null,
                            identity:null,
                            fill:null,
                            isTotal:true
                        });
                }, this);

                //push totals columns
                catX.push('Total');
                catY.push('Total');
            }

            return {
                dataPoints: dataPoints,
                categoryX: catX.filter(function (n) { return n !== undefined; }),
                categoryY: catY.filter(function (n) { return n !== undefined; }),
                //categoryValueFormatter: categoryValueFormatter,
                //legendValueFormatter: legendValueFormatter
            };
        }


       constructor(options: VisualConstructorOptions) {

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
                .attr("class", "svgCrossTab")
                .attr("height", this.svgSize.height)
                .attr("width", this.svgSize.width);

            this.selectionManager = options.host.createSelectionManager();
        }

        public update(options: VisualUpdateOptions): void {
            if (!options.dataViews || !options.dataViews[0]) return;
            this.svg.selectAll("*").remove();
            this.mainGraphics = this.svg;

            this.setViewportSize(options.viewport);
            this.updateInternal(options);  
                    
            this.setSVGSize(options.viewport);  
        }

        private updateInternal(options: VisualUpdateOptions): void {
            var dataView = this.dataView = options.dataViews[0];
            var showTotals = this.getShowTotals(options.dataViews[0]);
            var chartData = this.chartData = CrossTab.converter(dataView, this.dicColor, showTotals);
                   
            //var suppressAnimations = Boolean(options.suppressAnimations);
            
            if (chartData.dataPoints) {
                var minDataValue = d3.min(chartData.dataPoints, function (d: CrossTabDataPoint) { return d.value; });
                var maxDataValue = d3.max(chartData.dataPoints, function (d: CrossTabDataPoint) { return d.value; });

                //calculate the max length of the categoryX/Y columns as we cannot compute the width until after it's rendered
                var categoryXTextLength = 1, categoryYTextLength = 1, categoryXTextWidth = 10, categoryYTextWidth = 10;

                var showLegend = this.getShowLegend(dataView);
                var gridSizeWidth = 28, gridSizeHeight = 28;

                var legendElementWidth = gridSizeWidth;
                var legendElementHeight = gridSizeHeight / 2;

                var xOffset = gridSizeWidth + this.margin.left;
                var yOffset = this.margin.top;

                 var dicColor = this.dicColor = [];
                 this.getColors(dataView); 
            
                
                this.mainGraphics.selectAll(".categoryYLabel")
                    .data(chartData.categoryY)
                    .enter().append("text")
                    .text(<any>function (d) { 
                        return d; 
                    })
                    .attr("dy", ".71em")
                    //.attr("x", xOffset)
                    .attr("x", this.margin.left)
                    .attr("y", function (d, i) { 
                        return  (i * gridSizeHeight + (yOffset) / 2.5) + categoryYTextWidth; 
                     })
                    .style("text-anchor", "start")
                    .attr("transform", "translate(-6," + gridSizeHeight + ")")
                    .attr("class", "categoryYLabel mono axis")
                    .style("font-size","6pt");


                
           
                //this.mainGraphics.selectAll(".categoryYLabel")
                //     .call(this.wrap, gridSizeWidth);
              
                this.mainGraphics.selectAll(".categoryYLabel")
                    .each(function() { categoryXTextWidth = Math.max(categoryXTextWidth, this.getComputedTextLength()); });
                        
                this.mainGraphics.selectAll(".categoryXLabel")
                    .data(chartData.categoryX)
                    .enter().append("text")
                    .text(<any>function (d) { 
                        return d;
                    })
                    .attr("transform", function(d, i) { 
                          var deg = -90;
                          var cx = this.getComputedTextLength() / 2;
                          var cy = 20;
                          return "translate(" + (xOffset + categoryXTextWidth + ((i + 1) * gridSizeWidth)) + ", " + (0) + ")rotate(" + deg + "," + 0 + "," + yOffset + ")";
                     } )
                    .style("text-anchor","end") 
                    .attr("startOffset","100%")
                    .attr("dy", "-.5em")
                    .attr("class", "categoryXLabel mono axis");
                    

                //this.truncateTextIfNeeded(this.mainGraphics.selectAll(".categoryXLabel"), 200);
                
                //calculate categoryYTextWidth
                this.mainGraphics.selectAll(".categoryXLabel")
                    .each(function() { categoryYTextWidth = Math.max(categoryYTextWidth, this.getComputedTextLength()); });
               
               //re-apply categoryYTextWidth to CategoryYLabel
                this.mainGraphics.selectAll(".categoryYLabel")
                    .attr("y", function (d, i) { 
                        return  (i * gridSizeHeight + (yOffset) / 2.5) + categoryYTextWidth; 
                     })
                     
                //we need to wait until we have computed the category axis text widths before setting the svg size:
                this.svgSize.width = (gridSizeWidth * (chartData.categoryX.length + 1)) + categoryXTextWidth;
                this.svgSize.height = (gridSizeHeight * (chartData.categoryY.length + 1)) + categoryYTextWidth;
                if (showLegend)
                {
                    this.svgSize.height += gridSizeHeight + yOffset * 2;
                }
                
                var selectionManager = this.selectionManager;

                var heatMap = this.mainGraphics.selectAll(".categoryX")
                    .data(chartData.dataPoints)
                    .enter().append("rect")
                    .attr("x", function (d:any, i) { return (chartData.categoryX.indexOf(d.categoryX) * gridSizeWidth + xOffset) + (categoryXTextWidth - 10); })
                    .attr("y", function (d:any, i) { return ((chartData.categoryY.indexOf(d.categoryY) + 0.5) * gridSizeHeight + yOffset) + categoryYTextWidth; })
                    .attr("class", "categoryX bordered")
                    .attr("width", gridSizeWidth)
                    .attr("height", gridSizeHeight)
                    .attr("rx", 4)
                    .attr("ry", 4)
                    .style("stroke", 'white')
                    .style("stroke-width", 1)
                    .style("fill", '#E8E8E8');
                    

                  
                function getColor(val, isTotal:boolean) { 
                      if (isTotal) {
                        return '#5E5E5E';
                      } else if (dicColor[val]) {
                          return dicColor[val].solid.color;
                      } else {
                          return '#E8E8E8';
                      }                   
                }
                
                var elementAnimation: any = this.getAnimationMode(heatMap, true);
                elementAnimation.style("fill", function (d) { return getColor(d.value, d.isTotal) });
                
                var heatMap1 = this.mainGraphics.selectAll(".categoryX")
                .on('mouseover', function (d) {
                    d3.select(this).transition()
                        .ease("elastic")
                        .duration(1000)
                        .attr("rx", 8)
                        .attr('ry', 8)
                        
                    
                    mouseover(d.categoryX, d.categoryY);
                    //d3.event.stopPropagation();
                })
                .on('mouseout', function (d) {
                    d3.select(this).transition()
                        .ease("elastic")
                        .duration(1000)
                        .attr("rx", 4)
                        .attr('ry', 4)
                    mouseout();
                    //d3.event.stopPropagation();
                })
                .on('click', function (d) {
                    if (d.selected) {
                        d3.selectAll(".categoryX").style('opacity', 1);  
                        d.selected = null              
                    } else {
                        d3.selectAll(".categoryX").style('opacity', 0.6);
                        
                        //selectionManager.select(d.identity).then(ids => d3.select(this).style('opacity', 1));
                        d.selected = true;   
                    }                    
                })
                
                function mouseover(categoryX, categoryY) {
                    d3.selectAll(".categoryXLabel").classed("active", function(d, i) { return d == categoryX });
                    d3.selectAll(".categoryYLabel").classed("active", function(d, i) { return d == categoryY });
                  }
                
                  function mouseout() {
                    d3.selectAll("text").classed("active", false);
                  }

                var showDataInRect = this.getShowData(dataView);

            
                if (showDataInRect) {
                    this.mainGraphics.selectAll(".rectValue")
                        .data(chartData.dataPoints)
                        .enter().append("text")
                        .attr("x", function (d:any, i) { return (chartData.categoryX.indexOf(d.categoryX) * gridSizeWidth + xOffset) + categoryXTextWidth - 25; })
                        .attr("y", function (d:any, i) { return ((chartData.categoryY.indexOf(d.categoryY) + 0.75) * gridSizeHeight + yOffset) + categoryYTextWidth -2; })
                        .attr("dy", "1.81em")
                        .style("text-anchor", "middle")
                        .style("fill", "White")
                        .attr("class", "rectValue mono axis bar-text")
                        .attr("transform", "translate(" + gridSizeHeight + ", -6)")
                        .text(<any>function (d) {
                            if (d.value) {
                                return d.value.toString();//.substring(0,1)
                            } else {
                                return null;
                            }
                        });
                }
                else {
                    heatMap.append("title").text(<any>function (d) {
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
                        for (var i = 1; i <= 5; i++) {
                           if (general['color' + i] && general['color' + i + 'Val']) {
                                this.dicColor[general['color' + i + 'Val']] = general['color' + i];
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
                           return general['color' + colorNum];
                       }       
                    }
                }
            }
            return null;
        }
        
        private getColorVal(dataView: DataView, colorNum: string): number {
            if (dataView) {
                var objects = dataView.metadata.objects;
                if (objects) {
                    var general = objects['general'];
                    if (general) {
                       if (general['color' + colorNum + 'Val']) {
                           return general['color' + colorNum + 'Val'];
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
                           return general['color' + colorNum + 'LegendVal'];
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
                        return general['showdata'];
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
                        return general['showlegend'];
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
                        return general['showtotals'];
                    }
                }
            }
            return false;
        }
        
       public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] {
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
                            color1LegendVal:this.getLegendVal(dataView, '1'),               
                            color2:this.getColor(dataView, '2'),
                            color2Val:this.getColorVal(dataView, '2'),
                            color2LegendVal:this.getLegendVal(dataView, '2'),
                            color3:this.getColor(dataView, '3'),
                            color3Val:this.getColorVal(dataView, '3'),
                            color3LegendVal:this.getLegendVal(dataView, '3'),
                            color4:this.getColor(dataView, '4'),
                            color4Val:this.getColorVal(dataView, '5'),
                            color4LegendVal:this.getLegendVal(dataView, '4'),
                            color5:this.getColor(dataView, '6'),
                            color5Val:this.getColorVal(dataView, '6'),
                            color5LegendVal:this.getLegendVal(dataView, '5'),
                            showdata: this.getShowData(dataView),
                            showlegend: this.getShowLegend(dataView),
                            showtotals: this.getShowTotals(dataView)
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