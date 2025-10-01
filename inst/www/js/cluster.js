var samples = false,
    variables = false,
    table = false,
    defaultColor = "#808080",
    defaultShape = 0,
    plotSize = 400,
    colorList = ["#3366cc", "#ff9900", "#109618", "#990099", "#0099c6", "#dd4477", "#66aa00", "#b82e2e", "#316395", "#994499", "#22aa99", "#aaaa11", "#6633cc", "#e67300", "#8b0707", "#651067", "#329262", "#5574a6", "#3b3eac", "#dc3912"],
    symbolTypes = ["circle","square","diamond","triangle-up","cross","triangle-down"],
    strokewidth = 2,
    methodsDim = [],
    methodsCluster = [],
    clusterData = {},
    dimData = {},
    savedColors = {},
    savedShapes = {},
    groupStatsBy = [],
    groupby = false,
    groupbyColorscale = d3.scale.ordinal().range(colorList),
    heatmap = [],
    violin = -1;

var myGroups = {};

window.onscroll = function(){
  var fixed = document.body.scrollTop > 20 || document.documentElement.scrollTop > 20;
  d3.select('.sticky').classed("fixed",fixed ? true : false);
}

window.onload = function(){

    d3.select(".editable i.icon-sli-pencil").on("click", edit_name);
    d3.select(".editable i.icon-newspaper").on("click", generate_report);
    d3.select(".editable i.icon-download").on("click", save_json);
    d3.select(".selectsamples").on("click",selectsamples);
    d3.select("body").on('click',function(){
      d3.selectAll("ul.autocomplete-list").classed("hidden",true);
      d3.select("div.dropdown-list").remove();
    });

    var pre;

    pre = d3.select("pre.savedColors");
    if(!pre.empty()){
      savedColors = JSON.parse(pre.text().trim());
    }

    pre = d3.select("pre.savedShapes");
    if(!pre.empty()){
      savedShapes = JSON.parse(pre.text().trim());
    }

    samples = d3.select("pre.samples_txt").text().trim().split("\n");

    pre = d3.select("pre.variables_txt");
    if(!pre.empty()){
      variables = pre.text().trim().split("\n");

      pre = d3.select("pre.data_tsv");
      if(!pre.empty()){
        table = pre.text().split("\n").map(function(d){ return d.split("\t").map(function(e){ return +e; }); });
        table.pop();
      }else{
        //TODO: ajax request
      }
    }

    if(variables){
      d3.selectAll("input.variable-input").property("value","");
      [1,2,3,5].forEach(function(j){
        input_autocomplete("input-variable"+j,variables.map(function(d,i){ return [i,d]; }));
      });
      input_multisearch("input-variable4",variables.map(function(d,i){ return [i,d]; }));

      d3.select("div.newGraphs > div > button").on("click",new_graph);
      d3.select("div.variableColor > div > button").on("click",variable_color);
      d3.select("div.variableHeatmap > div > button").on("click",variable_heatmap);
      d3.select("div.variableViolin > div > button").on("click",variable_violin);
    }else{
      d3.select("div.sidebar > div.newGraphs").remove();
      d3.select("div.sidebar > div.variableColor").remove();
      d3.select("div.sidebar > div.variableHeatmap").remove();
      d3.select("div.sidebar > div.variableViolin").remove();
    }

    input_autocomplete("search-sample",samples.map(function(d,i){
        return [i,d];
    }),function(key){
        samples.forEach(function(d,i){
          d[1] = d[1] | key==i;
        });
        select_dots();
    });

    samples = samples.map(function(d){
        return [d,false,defaultColor,defaultShape];
    });

    d3.select("#search-pattern").on("keydown", search_pattern_keydown);

    d3.select(".plots > .loading").remove();

    pre = d3.select("pre.reductions_txt");
    if(!pre.empty()){
      methodsDim = pre.text().trim().split("\n");
    }

    pre = d3.select("pre.clusters_txt");
    if(!pre.empty()){
      methodsCluster = pre.text().trim().split("\n");
    }

    pre = d3.select("pre.groupstatsby_txt");
    if(!pre.empty()){
      groupStatsBy = pre.text().trim().split("\n");
    }

    methodsCluster.forEach(getCluster);
    methodsDim.forEach(getDimReduction);

    pre = d3.select("pre.mygroups_txt");
    if(!pre.empty()){
      var cluster = pre.text().trim();
      if(clusterData.hasOwnProperty(cluster)){
        var data = clusterData[cluster];
        data = data[0][1].map(function(d){ return data[0][0][+d]; });
        data.forEach(function(g,i){
          if(!myGroups.hasOwnProperty(g))
            myGroups[g] = [];
          myGroups[g].push(i);
        })
      }
    }

    list_myGroups();

    if(!d3.keys(savedColors).length && d3.keys(myGroups).length)
      d3.select("div.myGroups i.colorgroups").node().click();

  d3.select("input[type=radio][name=vs][value=all]").property("checked","checked");

  d3.select("i.newgroup").on("click",new_group)

  d3.select("button.addtogroup").on("click",add_to_group)

  d3.select("button.removefrom").on("click",remove_from_groups)

  d3.select("button.resetvis").on("click",reset_vis)

  d3.select("div.myGroups i.viewgroups").on("click",view_groups)

  displayGroupBySelect();

  if(savedColors.hasOwnProperty('numericData')){
    applyVariableColor(savedColors['numericData']);
  }

  var i = 0;
  do{
    pre = d3.select("pre.newPlot_"+i);
    i++;
    if(!pre.empty()){
      var newplotvars = pre.text().trim().split(",");
      new_graph_data(newplotvars[0],newplotvars[1]);
    }
  }while(!pre.empty())

  pre = d3.select("pre.heatmap");
  if(!pre.empty()){
    heatmap = pre.text().trim().split(",").map(function(d){ return +d; });
    renderheatmap();
  }

  pre = d3.select("pre.violin");
  if(!pre.empty()){
    violin = +pre.text().trim();
    renderviolin();
  }
} // window load end

function getClustersFromData(name,ncluster){
  var data = {};
  if(clusterData.hasOwnProperty(name)){
    var d = clusterData[name],
        idx = 0;
    if(+ncluster){
      for(var i=0; i<d.length; i++){
        if(d[i][0].length==+ncluster){
          idx = i;
          break;
        }
      }
    }
    var subdata = d[idx],
        groups = subdata[0];
    subdata = subdata[1];
    groups.forEach(function(g,j){
      var dd = subdata.map(function(d,i){ return [i,+d]; })
          .filter(function(d){ return d[1]==j; })
          .map(function(d){ return d[0]; });
      data[g] = dd;
    });
  }
  return data;
}

function displayGroupBySelect(){
  var data = [];
  groupStatsBy.forEach(function(d){
    if(clusterData.hasOwnProperty(d)){
      data.push(d);
    }
  })
  var div = d3.select("div.sidebar > div.groupBy");
  if(data.length){
    data.unshift("-none-");
    var ul = div.select("ul");
    var select = div.select("select")
      .on("change",function(){
        groupby = this.value;
        ul.selectAll("li").remove();
        if(groupby=="-none-"){
          groupby = false;
        }else{
          var groups = clusterData[groupby][0][0];
          groupbyColorscale.domain(groups);
          groups.forEach(function(g){
            var li = ul.append("li");
            display_bullet(li,groupbyColorscale(g));
            li.append("span").text(g);
          })
        }
        select_dots();
        list_myGroups();
        methodsCluster.forEach(function(name){
          if(clusterData.hasOwnProperty(name)){
            list_cluster(name);
          }
        })
      })
    .selectAll("option")
        .data(data)
      .enter().append("option")
        .property("value",String)
        .text(String)
  }else{
    div.remove();
  }
}

function new_graph(){
    if(samples){
      if(table){
        var variable1 = d3.select("#input-variable1").attr("key"),
            variable2 = d3.select("#input-variable2").attr("key");
        if(variable1===null || variable2===null){
          alert("Some variables are missing!");
        }else{
          new_graph_data(variable1,variable2);
        }
      }else
        alert("Wait until data are loaded.");
    }else
      alert("Wait until samples are loaded.");
    d3.selectAll("div.newGraphs > div > input")
      .attr("key",null)
      .property("value","");
}

function new_graph_data(variable1,variable2){
    variable1 = +variable1;
    variable2 = +variable2;
    var data = samples.map(function(){ return [null,null]; });
    table.forEach(function(d){
      if(d[1]==variable1){
        data[d[0]][0] = d[2];
      }
      if(d[1]==variable2){
        data[d[0]][1] = d[2];
      }
    });
    var title = variables[variable1]+" vs "+variables[variable2];
    renderplot(title, data, variables[variable1], variables[variable2]);
    d3.select(".div-plot."+sanitize_names(title)).attr("custom",[variable1,variable2].join(","));
}

function applyVariableColor(variable){
    if(samples){
      if(table){
          var data = samples.map(function(){ return null; });
          table.filter(function(d){ return d[1]==variable; }).forEach(function(d){
            data[d[0]] = d[2];
          });

          var colors = d3.scale.linear()
            .range(["#dc3912","#3366cc"])
            .domain(d3.extent(data.filter(function(d){ return d!==null; })))

          var div = d3.select("div.variableColor");
          reset_color_legends();
          var divScale = renderColorScale(div,colors);
          divScale.insert("h5",":first-child")
            .attr("class","margin-top-10")
            .text(variables[variable]);

          clickChangeScaleColors(divScale,variable,colors,data);
      }else
        alert("Wait until data are loaded.");
    }else
      alert("Wait until samples are loaded.");
}

function variable_color(){
    if(samples){   
      var variable = d3.select("#input-variable3").attr("key");
      if(variable===null){
        alert("Variable is missing!");
      }else{
        applyVariableColor(+variable);
      }
    }else
      alert("Wait until samples are loaded.");
    d3.select("div.variableColor > div > input").attr("key",null).property("value","");
}

function variable_heatmap(){
    if(samples){   
      var variable = d3.select("#input-variable4").attr("key");
      if(variable===null){
        alert("Variable is missing!");
      }else{
        heatmap = variable.split(",").map(function(d){ return +d; });
        renderheatmap();
      }
    }else
      alert("Wait until samples are loaded.");
    d3.select("div.variableHeatmap > div > input").attr("key",null).property("value","");
}

function variable_violin(){
    if(samples){   
      var variable = d3.select("#input-variable5").attr("key");
      if(variable===null){
        alert("Variable is missing!");
      }else{
        violin = +variable;
        renderviolin();
      }
    }else
      alert("Wait until samples are loaded.");
    d3.select("div.variableViolin > div > input").attr("key",null).property("value","");
}

function new_group(){
  if(samples){
    var input = d3.select("div.myGroups").insert("input","div.myGroups > ul")
    .attr("type", "text")
    .attr("maxlength",32)
    .attr("class","margin-bottom-10")
    .style("width","80%")
    .on("keypress",function(){
      if(d3.event.keyCode === 13){
        var input = d3.select(this);
        var txt = sanitize_names(input.property("value"));
        if(txt!="" && d3.keys(myGroups).indexOf(txt)==-1){
          myGroups[txt] = [];
          samples.forEach(function(d,i){
            if(d[1])
              myGroups[txt].push(i);
          });
        }
        input.node().blur();
        list_myGroups();
      }
    })
    .on("blur",function(){
      d3.select(this).remove();
    }).node().focus();
  }else
    alert("Wait until samples are loaded.");
}

function add_to_group(){
  var groups = d3.keys(myGroups);
  if(!groups.length){
    alert("My groups are empty!");
  }else{
    var html = "<ul>";
    groups.forEach(function(e){
      html += "<li>"+e+"</li>";
    })
    html += "</ul>";
    display_list(html,function(){
        var val = this.textContent,
            someSelected = false,
            alreadyIn = true;
        samples.forEach(function(d,i){
          if(d[1]){
            someSelected = true;
            if(myGroups[val].indexOf(i)==-1){
              alreadyIn = false;
              myGroups[val].push(i);
            }
          }
        });
        if(someSelected && !alreadyIn){
          list_myGroups(true);
        }else{
          if(!someSelected)
            alert("Nothing selected!");
          else
            alert("Already in this group!");
          d3.select(this).select("option").property("selected",true)
        }
    });
  }
}

function remove_from_groups(){
  var groups = d3.keys(myGroups),
      someSelected = false;
  if(groups.length){
      samples.forEach(function(d,i){
        if(d[1]){
          someSelected = true;
          groups.forEach(function(val){
            var index = myGroups[val].indexOf(i);
            if(index!=-1)
              myGroups[val].splice(index,1);
          });
        }
      });
      if(!someSelected)
        alert("Nothing selected!");
      else
        list_myGroups(true);
  }else
    alert("My groups are empty!");
}

function reset_vis(){
  reset_color_legends();
  reset_shape_legends();
  samples.forEach(function(d,i){
    d[1] = false;
    d[2] = defaultColor;
    d[3] = defaultShape;
  })
  d3.selectAll("div.plots > div").remove();
  methodsDim.forEach(getDimReduction);
}

function view_groups(){
    var txt = "";
    d3.keys(myGroups).forEach(function(d){
      txt += "<h4 class=\"margin-top-15\">"+d+"</h4><ul>";
      if(myGroups[d].length){
        myGroups[d].forEach(function(e){
          txt += "<li>"+samples[e][0]+"</li>";
        })
      }else
        txt += "<li>&lt;empty&gt;</li>";
      txt += "</ul>";
    });
    display_window(txt);
}

function renderplot(name,data,xlab,ylab,big){

  var sanitized_name = sanitize_names(name);

  var margin = {top: 30, right: 20, bottom: 40, left: 50},
    tWidth = getPlotWidth(big),
    tHeight = tWidth,
    width = tWidth - margin.left - margin.right,
    height = tHeight - margin.top - margin.bottom;

  var zooming = false;

  var plots = d3.select("div.plots"),
      div = d3.select("div.plots div."+sanitized_name);

  if(div.empty()){
    if(methodsDim.indexOf(name)!=-1 && !big){
      div = plots.append('div');
    }else{
      div = plots.insert('div', ':first-child');
    }

    div.attr("class","div-plot " + sanitized_name)

    var h4 = div.append("h4")
       .attr("class","margin-bottom-0 margin-top-15 text-center")
    h4.append("span")
      .text(name)
  }else{
    if(!data)
      return;
    else
      div.select("svg").remove();
  }

  if(!data){
    div.append("svg")
      .attr("width", tWidth)
      .attr("height", tHeight)
      .append("image")
        .attr("x",(tWidth/2)-40)
        .attr("y",(tHeight/2)-40)
        .attr("width",80)
        .attr("height",80)
        .attr("xlink:href","images/loading.svg")
    return;
  }else{

    var resizeicon = big ? "actual" : "fullscreen";
    if(div.select("h4 > i.icon-sli-size-"+resizeicon).empty()){
      div.select("h4").insert("i",":first-child")
      .attr("class","icon-sli-size-"+resizeicon+" text-dark")
      .attr("title",big ? "Set normal size" : "Set bigger size")
      .style("float","left")
      .on("click",function(){
          div.remove();
          renderplot(name,data,xlab,ylab,!big);
      })
    }

    if(div.select("h4 > i.icon-reset-scale").empty())
      div.select("h4").insert("i",":first-child")
      .attr("class","icon-reset-scale text-dark")
      .attr("title","Set 100% zoom")
      .style("float","left")
      .on("click",function(){
        g.call(zoom.translate([0, 0]).scale(1).event);
        if(!zooming)
          view.style("cursor","crosshair");
      })

    if(div.select("h4 > i.icon-magnifying").empty())
      div.select("h4").insert("i",":first-child")
      .attr("class","icon-magnifying text-dark")
      .attr("title","Enable Zoom with mouse scroll")
      .style("float","left")
      .style("opacity","0.4")
      .on("click",toogleZooming)

    if(div.select("h4 > i.icon-cross_mark").empty())
      div.select("h4").insert("i",":first-child")
      .attr("class","icon-cross_mark text-primary")
      .attr("title","remove this plot")
      .style("float","left")
      .on("click",function(){
        div.remove();
        if(dimData.hasOwnProperty(name)){
          d3.select(".minimized-plots").append("div")
            .attr("class",sanitized_name)
            .html('<i class="icon-plus text-white"></i> ' +name)
            .on("click",function(){
              d3.select(this).remove();
              renderplot(name,dimData[name],xlab,ylab);
            })
        }
      })
  }

  var x = d3.scale.linear()
    .range([0, width]);

  var y = d3.scale.linear()
    .range([height, 0]);

  var zoom = d3.behavior.zoom()
    .scaleExtent([1, 8])
    .on("zoomstart", zoomstarted)
    .on("zoom", zoomed)
    .on("zoomend", zoomended);

  var xAxis = d3.svg.axis()
    .scale(x)
    .tickFormat(formatter)
    .innerTickSize(-height)
    .outerTickSize(0)
    .tickPadding(10)
    .orient("bottom");

  var yAxis = d3.svg.axis()
    .scale(y)
    .tickFormat(formatter)
    .innerTickSize(-width)
    .outerTickSize(0)
    .tickPadding(10)
    .orient("left");

  var svg = div.append("svg")
    .attr("width", tWidth)
    .attr("height", tHeight)

  svg.append("defs")
    .append("clipPath")
    .attr("id", "mask_"+sanitized_name)
    .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

  var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Lasso functions to execute while lassoing
var lasso_start = function() {

  lasso.items()
    .style("fill",null) // clear all of the fills
    .classed({"not_possible":true,"selected":false}) // style as not possible
    .each(function(d) {
      samples[d.index][1] = false; // deselect all samples
    })

  select_dots();
};

var lasso_draw = function() {
  // Style the possible dots
  lasso.items().filter(function(d) {return d.possible===true})
    .classed({"not_possible":false,"possible":true});

  // Style the not possible dot
  lasso.items().filter(function(d) {return d.possible===false})
    .classed({"not_possible":true,"possible":false});
};

var lasso_end = function() {
  // Reset the color of all dots
  lasso.items()
     .classed({"not_possible":false,"possible":false})
     .style("fill", function(d,i) { return samples[i][2]; });

  // Style the selected dots
  lasso.items().each(function(d) {
    samples[d.index][1] = d.selected===true;
  })

  select_dots();
};

  var xDom = [Infinity,-Infinity],
      yDom = [Infinity,-Infinity];

  data.forEach(function(d,i){
    d.index = i;

    if(d[0]!==null){
      if(d[0]<xDom[0]){
        xDom[0] = d[0];
      }
      if(d[0]>xDom[1]){
        xDom[1] = d[0];
      }
    }

    if(d[1]!==null){
      if(d[1]<yDom[0]){
        yDom[0] = d[1];
      }
      if(d[1]>yDom[1]){
        yDom[1] = d[1];
      }
    }
  })

  var xlen = xDom[1] - xDom[0],
      ylen = yDom[1] - yDom[0];

  xDom[0] = (xDom[0]-(xlen/50));
  xDom[1] = (xDom[1]+(xlen/50));
  yDom[0] = (yDom[0]-(ylen/50));
  yDom[1] = (yDom[1]+(ylen/50));

  x.domain(xDom)
  y.domain(yDom)

  zoom.x(x)
      .y(y)

  var gX = g.append("g")
      .attr("class", "x axis grid")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)

  gX.selectAll(".tick text")
	  .attr("x", 6)
	  .attr("y", 6)
	  .attr("transform", "rotate(45)")
	  .style("text-anchor", "start")

  gX.append("text")
      .attr("class", "label")
      .attr("x", width)
      .attr("y", -2)
      .style("text-anchor", "end")
      .text(xlab);

  var gY = g.append("g")
      .attr("class", "y axis grid")
      .call(yAxis)

  gY.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("x", 0)
      .attr("y", 2)
      .attr("dy", ".80em")
      .style("text-anchor", "end")
      .text(ylab)

  var view = g.append("g")
    .attr("class","view")
    .style("cursor","crosshair")
    .attr("clip-path", "url(#mask_"+sanitized_name+")");

  // Create the area where the zoom event can be triggered
  var zoom_area = view.append("rect")
                      .attr("width",width)
                      .attr("height",height)
                      .style("opacity",0);

  // Create the area where the lasso event can be triggered
  var multi_area = view.append("rect")
                      .attr("width",width)
                      .attr("height",height)
                      .style("opacity",0);

  view.selectAll(".dot")
      .data(data)
    .enter().append("path")
      .attr("class", "dot")
      .attr("transform", function(d) {
        var posx = d[0]==null ? x.range()[0] : x(d[0]),
            posy = d[1]==null ? y.range()[0] : y(d[1]);
        return "translate("+posx+","+posy+")scale(1)";
      })
      .on("click",function(d){
        if(!zooming){
          lasso.items().each(function(e) {
            samples[e.index][1] = d.selected = false;
          })
          samples[d.index][1] = d.selected = true;
          select_dots();
        }
      })
      .append("title")
        .text(function(d,i){
          return samples[i][0];
        })

  // Define the lasso
  var lasso = d3.lasso()
      .closePathDistance(75) // max distance for the lasso loop to be closed
      .closePathSelect(true) // can items be selected by closing the path?
      .hoverSelect(true) // can items by selected by hovering over them?
      .area(multi_area) // area where the lasso can be started
      .on("start",lasso_start) // lasso start function
      .on("draw",lasso_draw) // lasso draw function
      .on("end",lasso_end); // lasso end function

  // Init the lasso on the svg:g that contains the dots
  g.call(lasso);

  g.select("g.lasso").style("cursor","crosshair");

  lasso.items(view.selectAll(".dot"));

  update_color();
  update_shape();
  select_dots();

  function zoomstarted() {
      view.style("cursor","grabbing");
  }
  function zoomended() {
      view.style("cursor","grab");
  }
  function zoomed() {
      gX.call(xAxis);
      gX.selectAll(".tick text")
        .attr("x", 6)
        .attr("y", 6)
        .attr("transform", "rotate(45)")
        .style("text-anchor", "start")
      gY.call(yAxis);
      view.selectAll(".dot")
        .attr("transform", function(d) { return "translate("+x(d[0])+","+y(d[1])+")scale("+(Math.log(d3.event.scale)+1)+")"; })
  }

  function toogleZooming(){
        zooming = !zooming;
        view.style("cursor",zooming? "grab" : "crosshair");
        multi_area.style("display",zooming?"none":null);
        d3.select(this).style("opacity",zooming?"1":"0.4");
        if(zooming)
          g.call(zoom);
        else
          g.on('.zoom', null);
  }
}

function renderviolin(){
  if(violin==-1){
    return;
  }

  var name = variables[violin],
      slug = sanitize_names(name),
      xlab = "",
      ylab = "counts";

  var yDom = [0,-Infinity];

  var data = {},
      data1 = samples.map(function(){ return 0; });
  table.forEach(function(dd){
    if(dd[1]==violin){
      data1[dd[0]] = dd[2];
      if(dd[2]>yDom[1]){
        yDom[1] = dd[2];
      }
    }
  });
  d3.keys(myGroups).sort().forEach(function(d){
        if(myGroups[d].length){
          var subdata = myGroups[d].map(function(dd){
            return data1[dd];
          });
          data[d] = subdata;
        }
  });

  var margin = {top: 30, right: 20, bottom: 40, left: 50},
    tWidth = getPlotWidth(true),
    tHeight = tWidth,
    width = tWidth - margin.left - margin.right,
    height = tHeight - margin.top - margin.bottom;

  var plots = d3.select("div.plots"),
      div = plots.select("div.violin-"+slug);

  if(!div.empty()){
    div.remove();
  }

  div = plots.insert('div', ':first-child');

  div.attr("class","div-plot violin-"+slug)

  var h4 = div.append("h4")
       .attr("class","margin-bottom-0 margin-top-15 text-center")
  h4.append("span")
      .text(name)

  div.select("h4").insert("i",":first-child")
      .attr("class","icon-cross_mark text-primary")
      .attr("title","remove this plot")
      .style("float","left")
      .on("click",function(){
        div.remove();
        violin = -1;
      })

  var x = d3.scale.ordinal()
    .rangeRoundBands([0, width], .1);

  var y = d3.scale.linear()
    .range([height, 0]);

  var xAxis = d3.svg.axis()
    .scale(x)
    .innerTickSize(-height)
    .outerTickSize(0)
    .tickPadding(10)
    .orient("bottom");

  var yAxis = d3.svg.axis()
    .scale(y)
    .tickFormat(formatter)
    .innerTickSize(-width)
    .outerTickSize(0)
    .tickPadding(10)
    .orient("left");

  var svg = div.append("svg")
    .attr("width", tWidth)
    .attr("height", tHeight)

  var g = svg.append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  var ylen = yDom[1] - yDom[0];

  yDom[0] = (yDom[0]-(ylen/50));
  yDom[1] = (yDom[1]+(ylen/50));

  x.domain(d3.keys(data))
  y.domain(yDom)

  var gX = g.append("g")
      .attr("class", "x axis grid")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)

  gX.selectAll(".tick text")
	  .attr("x", 6)
	  .attr("y", 6)
	  .attr("transform", "rotate(45)")
	  .style("text-anchor", "start")

  gX.append("text")
      .attr("class", "label")
      .attr("x", width)
      .attr("y", -2)
      .style("text-anchor", "end")
      .text(xlab);

  var gY = g.append("g")
      .attr("class", "y axis grid")
      .call(yAxis)

  gY.append("text")
      .attr("class", "label")
      .attr("transform", "rotate(-90)")
      .attr("x", 0)
      .attr("y", 2)
      .attr("dy", ".80em")
      .style("text-anchor", "end")
      .text(ylab)

  var histogram = d3.layout.histogram()
        .bins(y.ticks(20))
        .value(function(d){ return d; })

  var sumstat = [],
      maxNum = 0;
  for(var k in data){
    var hist = histogram(data[k]);
    sumstat.push({key: k, value: hist}); 
    var longuest = d3.max(hist.map(function(d){ return d.length; }));
    if (longuest > maxNum){
      maxNum = longuest;
    }
  }

  var xNum = d3.scale.linear()
    .range([0, x.rangeBand()])
    .domain([-maxNum,maxNum])

  var groupColors = [];
  d3.selectAll(".myGroups > ul > li > svg > path").each(function(){
    groupColors.push(d3.select(this).style("fill"));
  });

  g.selectAll("groupviolin")
    .data(sumstat)
    .enter()
    .append("g")
      .attr("class","groupviolin")
      .attr("transform", function(d){ return("translate(" + x(d.key) +" ,0)") } )
      .append("path")
        .datum(function(d){ return(d.value)})
        .style("stroke", "none")
        .style("fill",function(d,i){
          return groupColors[i];
        })
        .attr("d", d3.svg.area()
            .x0(function(d){ return(xNum(-d.length)) } )
            .x1(function(d){ return(xNum(d.length)) } )
            .y(function(d){ return(y(d.x)) } )
            .interpolate("cardinal")
        )
}

function renderheatmap(){
  var plots = d3.select("div.plots"),
      div = plots.select("div.heatmap");

  if(!div.empty()){
    div.remove();
  }

  if(!heatmap.length || !table){
    return;
  }

  var heatmapVariables = heatmap;

  var margin = {top: 40, right: 0, bottom: 0, left: 60},
    tWidth = getPlotWidth(true),
    tHeight = tWidth;

  div = plots.insert('div', ':first-child');

  div.attr("class","div-plot heatmap")

  var h4 = div.append("h4")
       .attr("class","margin-bottom-0 margin-top-15 text-center")
  h4.append("span")
      .text("heatmap")

  div.select("h4").insert("i",":first-child")
      .attr("class","icon-cross_mark text-primary")
      .attr("title","remove this plot")
      .style("float","left")
      .on("click",function(){
        div.remove();
        heatmap = [];
      })

  var canvas = div.append("canvas")
     .attr("width",tWidth)
     .attr("height",tHeight)

  var ctx = canvas.node().getContext("2d");
  ctx.clearRect(0, 0, tWidth, tHeight);

  var subtable = table.filter(function(d){
    return heatmapVariables.indexOf(+d[1])!=-1;
  });

  var colors = d3.scale.linear()
    .range(["#dc3912","#3366cc"])
    .domain(d3.extent(subtable,function(d){ return +d[2]; }))

  var ydomain = heatmapVariables.sort();

  var x = d3.scale.linear()
    .range([margin.left,tWidth-margin.right])
    .domain([0,samples.length])

  var y = d3.scale.ordinal()
    .rangeBands([margin.top,tHeight-margin.bottom])
    .domain(ydomain)

  subtable.forEach(function(d){
      ctx.beginPath();    
      ctx.fillStyle = colors(+d[2]);
      ctx.rect(x(+d[0]), y(+d[1]), x(1), y.rangeBand());
      ctx.fill();
  })

  var grd = ctx.createLinearGradient(tWidth/2,0,tWidth,0);
  grd.addColorStop(0,colors.range()[0]);
  grd.addColorStop(1,colors.range()[1]);

  ctx.fillStyle = grd;
  ctx.fillRect(tWidth/2, 10, tWidth/2, 10);

  ctx.fillStyle = "#000000";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(String(colors.domain()[0]),tWidth/2,29);
  ctx.textAlign = "right";
  ctx.fillText(String(colors.domain()[1]),tWidth,29);

  heatmapVariables.forEach(function(d,i){
    ctx.fillText(variables[d],margin.left-2,y(d)+(y.rangeBand()/2)+6);
  });

  samples.forEach(function(s,i){
      ctx.beginPath();
      ctx.fillStyle = s[2];
      ctx.rect(x(i), margin.top-10, x(1), 10);
      ctx.fill();
  });
}

function getPlotWidth(big){
  var plotsWidth = d3.select("div.plots").node().getBoundingClientRect().width-8;
  return d3.min([plotsWidth,plotSize*(big?2:1)]);
}

function renderColorScale(div,colors){
  var divScale = div.append("div")
      .attr("class","color-scale")

  divScale.append("div")
      .style("background-image","linear-gradient(to right, "+colors.range().join(",")+")")

  divScale.append("span")
      .text(formatter(colors.domain()[0]))

  divScale.append("span")
      .style("text-align","right")
      .text(formatter(colors.domain()[1]))

  return divScale;
}

function list_cluster(name,nclusters){

  var div = d3.select("div.sidebar div."+name)
  if(div.empty())
    div = d3.select("div.sidebar")
              .append("div")
              .attr("class",name+" margin-top-15");
  else
    div.selectAll("*").remove();

  var h4 = div.append("h4").text(name);

  if(!clusterData.hasOwnProperty(name)){
    h4.append("img")
      .style("width","30px")
      .style("height","30px")
      .style("display","inline-block")
      .style("margin-bottom","-10px")
      .attr("src","images/loading.svg")
    return;
  }

  var data = clusterData[name];
  var iter = data.map(function(d){ return d[0].length; });

  if(typeof nclusters == "undefined"){
    var n = div.select("h4.ncluster");
    if(!n.empty()){
      nclusters = n.text();
    }else{
      nclusters = iter[0];
    }
  }
  nclusters = +nclusters;

  var clusters = getClustersFromData(name,nclusters),
      groups = d3.keys(clusters),
      color = d3.scale.ordinal().range(colorList),
      shape = d3.scale.ordinal().range(symbolTypes),
      colors = groups.map(function(d){
        return color(d);
      }),
      shapes = groups.map(function(d){
        return shape(d);
      }),
      filtdata = groups.map(function(g){ return clusters[g]; });

  var ul = div.append("ul")
             .attr("class","hidden i-options");

  h4.append("i")
      .attr("title","show/hide cluster list")
      .attr("class","icon-chevron_down text-dark")
      .on("click",function(){
        var ul = d3.select(this.parentNode.parentNode).select("ul");
        ul.classed("hidden",ul.classed("hidden") ? false : true);
      })
  h4.append("i")
      .attr("title","Add to my groups")
      .attr("class","icon-star_empty text-dark")
      .on("click",function(){
          groups.forEach(function(d,i){
            myGroups[d] = filtdata[i];
          })
          list_myGroups();
      })
  h4.append("i")
      .attr("title","Automatic coloring of groups")
      .attr("class","icon-node_color text-dark")
      .on("click",function(){
        clickChangeAllColors(ul, groups, colors, filtdata, nclusters);
      })
  h4.append("i")
      .attr("title","Automatic shape change")
      .attr("class","icon-node_shape text-dark")
      .on("click",function(){
        clickChangeAllShapes(ul, groups, shapes, filtdata, nclusters);
      })
  if(iter.length>1){
      h4.append("i")
        .attr("class","icon background-dark text-white border-radius ncluster")
        .style("padding","0 0.8ex 0 0.4ex")
        .attr("title","Number of clusters")
        .text(nclusters)
        .on("click",function(){
          var html = "<ul>";
          iter.forEach(function(e){
            html += "<li>"+e+"</li>";
          })
          html += "</ul>";
          display_list(html,function(){
            list_cluster(name,d3.select(this).text());
          });
        })
  }

  groups.forEach(function(d,i){
    var li = ul.append("li"),
        subdata = filtdata[i];

    vis_and_bullet(li,d+"_"+nclusters,subdata);
    li.append("span")
        .html(d + " (" + getClusterCuantities(subdata) + ")")
        .on("click",function(){ clickSelectDots(subdata); })
    li.append("i")
        .attr("class","icon-node_color text-dark")
        .attr("title","Change this cluster color")
        .on("click",function(){ clickChangeColor(subdata,li,d,nclusters); })
    li.append("i")
        .attr("class","icon-node_shape text-dark")
        .attr("title","Change this cluster shape")
        .on("click",function(){ clickChangeShape(subdata,li,d,nclusters); })
  });
}

function getClusterCuantities(subdata){
    var number = subdata.length;
    if(groupby && clusterData.hasOwnProperty(groupby)){
      number = [number];
      var clusters = getClustersFromData(groupby);
      d3.keys(clusters).forEach(function(g,i){
        var count = 0,
            samples = clusters[g];
        subdata.forEach(function(dd){
          if(samples.indexOf(dd)!=-1){
            count++;
          }
        })
        number.push('<span style="color:'+groupbyColorscale(g)+';">'+formatter((count/samples.length)*100) + "%</span>");
      })
      number = number.join(", ");
    }
    return number;
}

function list_myGroups(vis){
  var groups = d3.keys(myGroups).sort(),
      color = d3.scale.ordinal().range(colorList),
      shape = d3.scale.ordinal().range(symbolTypes),
      colors = groups.map(function(d){
        return color(d);
      }),
      shapes = groups.map(function(d){
        return shape(d);
      });

  if(vis){
    samples.forEach(function(d,i){
      d[2] = defaultColor;
      d[3] = defaultShape;
    })
    update_color();
    update_shape();
  }

  var ul = d3.select("div.myGroups > ul");

  if(groups.length){
    ul.selectAll("*").remove();
    groups.forEach(function(d,i){
      var li = ul.append("li"),
          subdata = myGroups[d];
      vis_and_bullet(li,d+"_0",subdata);
      li.append("span")
        .html(d + " (" + getClusterCuantities(subdata) + ")")
        .on("click",function(){ clickSelectDots(subdata); })
      li.append("i")
          .attr("class","icon-cross_mark text-dark")
          .on("click",function(){
            delete_myGroup(d);
            list_myGroups(true);
          })
      li.append("i")
        .attr("class","icon-node_color text-dark")
        .attr("title","Change this cluster color")
        .on("click",function(){ clickChangeColor(subdata,li,d,0); })
      li.append("i")
        .attr("class","icon-node_shape text-dark")
        .attr("title","Change this cluster shape")
        .on("click",function(){ clickChangeShape(subdata,li,d,0); })
    })

    d3.select("div.myGroups i.viewgroups")
      .style("display","inline")

    d3.select("div.myGroups i.colorgroups")
      .style("display","inline")
      .on("click",function(){
        clickChangeAllColors(ul, groups, colors, myGroups, 0);
      })

    d3.select("div.myGroups i.shapegroups")
      .style("display","inline")
      .on("click",function(){
        clickChangeAllShapes(ul, groups, shapes, myGroups, 0);
      })

    d3.select("div.myGroups i.downloadgroups")
      .style("display","inline")
      .on("click",function(){
        display_list("<ul><li>tsv</li><li>xlsx</li><li>R script</li></ul>",function(){
          var method = d3.select(this).text(),
              name = d3.select("h2.editable > span").text();
          if(method=="tsv"){
            var txt = "group\tsample\n";
            d3.keys(myGroups).forEach(function(d){
              if(myGroups[d].length){
                myGroups[d].forEach(function(e){
                  txt += d+"\t"+samples[e][0]+"\n";
                })
              }
            });
            downloadFile(name+".tsv",txt);
          }
          if(method=="xlsx"){
            var data = [["group","sample"]];
            d3.keys(myGroups).forEach(function(d){
              if(myGroups[d].length){
                myGroups[d].forEach(function(e){
                  data.push([d,samples[e][0]]);
                })
              }
            });
            downloadExcel({sheet1:data},name);
          }
          if(method=="R script"){
            var groupsvector = [], samplesvector = [];
            d3.keys(myGroups).forEach(function(d){
              if(myGroups[d].length){
                myGroups[d].forEach(function(e){
                  groupsvector.push(d);
                  samplesvector.push(samples[e][0]);
                })
              }
            });
            var txt = "myGroups <- data.frame(\n"
+ "group=c('"+groupsvector.join("','")+"'),\n"
+ "sample=c('"+samplesvector.join("','")+"')\n"
+ ")";
            downloadFile(name+".R",txt);
          }
        });
      })

  }else{
    ul.html("<li>&lt;empty&gt;</li>");
    d3.select("div.myGroups i.colorgroups").style("display",null);
    d3.select("div.myGroups i.shapegroups").style("display",null);
    d3.select("div.myGroups i.viewgroups").style("display",null);
    d3.select("div.myGroups i.downloadgroups").style("display",null);
  }
}

function delete_myGroup(group){
        var namegroup = group + "_0";
        if(savedColors.hasOwnProperty(namegroup)){
              delete savedColors[namegroup];
        }
        if(savedShapes.hasOwnProperty(namegroup)){
              delete savedShapes[namegroup];
        }

        delete myGroups[group];
}

function clickSelectDots(data){
    if(samples){
        samples.forEach(function(e){
          e[1] = false;
        })
        data.forEach(function(i){
          samples[i][1] = true;
        })
        select_dots();
    }
}

function clickChangeScaleColors(div, name, colors, data){
        savedColors["numericData"] = name;
        samples.forEach(function(d,i){
          if(data[i]!==null){
            d[2] = colors(data[i]);
          }else{
            d[2] = colors.range()[0];
          }
        })
        update_color();

        div.classed("hidden",false);
}

function clickChangeAllColors(ul, groups, colors, data, index){
        reset_color_legends();
        ul.selectAll("li > svg > path").style("fill",function(d,i){
          savedColors[groups[i] + "_" + index] = colors[i];
          return colors[i];
        })
        samples.forEach(function(d,i){
            d[2] = defaultColor;
        })
        groups.forEach(function(g,j){
          data[index ? j : g].forEach(function(i){
            samples[i][2] = colors[j];
          });
        });
        update_color();
}

function clickChangeAllShapes(ul, groups, shapes, data, index){
        reset_shape_legends();
        ul.selectAll("li > svg > path").attr("d",d3.svg.symbol().type(function(d,i){
          savedShapes[groups[i] + "_" + index] = shapes[i];
          return shapes[i];
        }).size(32))
        samples.forEach(function(d,i){
            d[3] = defaultShape;
        })
        groups.forEach(function(g,j){
          data[index ? j : g].forEach(function(i){
            samples[i][3] = symbolTypes.indexOf(shapes[j]);
          });
        });
        update_shape();
}

function clickChangeColor(data,li,name,index){
          var html = "<ul>";
          colorList.forEach(function(e){
            html += "<li style=\"background-color: "+e+"; color: "+e+";\">"+e+"</li>";
          })
          html += "</ul>";
          display_list(html,function(){
            var color = d3.select(this).text();
            li.select("svg path").style("fill",color);
            savedColors[name + "_" + index] = color;

            changeColor(data,color);
          });
}

function clickChangeShape(data,li,name,index){
          var html = "<ul>";
          symbolTypes.forEach(function(e){
            html += "<li symbol=\""+e+"\"><svg width=\"24\" height=\"24\"><path transform=\"translate(12,12)\" d=\""+d3.svg.symbol().type(e).size(128)()+"\"></path></svg></li>";
          })
          html += "</ul>";
          display_list(html,function(){
            var shape = d3.select(this).attr("symbol");
            li.select("svg path").attr("d",d3.svg.symbol().type(shape).size(32))
            savedShapes[name + "_" + index] = shape;

            changeShape(data,shape);
          });
}

function display_list(html,callback){
  d3.event.stopPropagation();
  d3.selectAll("div.dropdown-list").remove();

  var coor = d3.mouse(d3.select("body").node());

  var div = d3.select("body").append("div")
    .attr("class","dropdown-list padding block-bordered border-radius")
    .style("position","absolute")
    .style("top",(coor[1]+10)+"px")
    .style("left",(coor[0]+10)+"px");

  div.html(html);

  div.selectAll("li").on("click",callback);
}

function changeColor(data,color){
    data.forEach(function(i){
      samples[i][2] = color;
    })
    update_color();
}

function changeShape(data,shape){
    if(Array.isArray(shape)){
      shape = shape[0];
    }
    data.forEach(function(i){
      samples[i][3] = symbolTypes.indexOf(shape);
    })
    update_shape();
}

function update_color(){
  d3.selectAll("div.plots .dot").style("fill",function(d){
    return samples[d.index][2];
  })
  renderheatmap();
  renderviolin();
}

function update_shape(){
  d3.selectAll("div.plots .dot").attr("d",d3.svg.symbol().type(function(d){
    return symbolTypes[samples[d.index][3]];
  }).size(32))
}

function reset_color_legends(){
  d3.selectAll("ul.i-options > li > svg > path")
    .style("fill",d3.select("ul.i-options > li").style("color"))
  d3.select("div.sidebar > div.variableColor > .color-scale").remove();
  savedColors = {};
}

function reset_shape_legends(){
  d3.selectAll("ul.i-options > li > svg > path")
    .attr("d",d3.svg.symbol().type(defaultShape).size(32))
  savedShapes = {};
}

function vis_and_bullet(li,name,data){
  var color = li.style("color"),
      shape = defaultShape;

  if(savedColors.hasOwnProperty(name)){
    color = savedColors[name];
    changeColor(data,color);
  }
  if(savedShapes.hasOwnProperty(name)){
    shape = savedShapes[name];
    changeShape(data,shape);
  }

  display_bullet(li,color,shape);
}

function display_bullet(li,color,shape){
    if(!color){
      color = defaultColor;
    }
    if(!shape){
      shape = symbolTypes[defaultShape];
    }
        li.append("svg")
        .style("margin","0 5px 0 -10px")
        .attr("width",10)
        .attr("height",10)
        .append("path")
          .style("fill",color)
          .attr("transform","translate(5,5)")
          .attr("d",d3.svg.symbol().type(shape).size(32))
}

function selectsamples(){
    if(samples){
      var select = Boolean(this.checked);
      samples.forEach(function(d,i){
        d[1] = select;
      });
      select_dots();
    }
}

function select_dots(){
    var sidebar = d3.select(".sidebar2"),
        ul = sidebar.select("ul.selected-samples");
    ul.selectAll("*").remove();

    var subdata = [];
    samples.forEach(function(d,i){
      if(d[1]){
        subdata.push(i);
        ul.append("li")
            .text(d[0])
            .append("i")
              .attr("class","icon-cross_mark text-dark background-white border-radius")
              .on("click",function(){
                samples[i][1] = false;
                select_dots();
              })
      }
    })

    if(!subdata.length){
      ul.append("li").text("<empty>");
      d3.select("input.selectsamples").property("checked",false);
    }else{
      d3.select("input.selectsamples").property("checked",true);
    }

    sidebar.select(".grouped-stats").remove();
    if(subdata.length && groupby){
        sidebar.insert("div","ul.selected-samples")
          .attr("class","grouped-stats margin-bottom-15")
          .html(getClusterCuantities(subdata));
    }

    var view = d3.selectAll("div.plots svg .view");
    view.selectAll(".dot.selected").remove()
    view.selectAll(".dot").each(function(d){
      if(samples[d.index][1]){
        var clone = d3.select(this.parentNode.appendChild(this.cloneNode()));
        clone.datum(d3.select(this).datum());
        clone.attr("class","dot selected")
             .attr("stroke","#ff0000")
             .style("stroke-width",strokewidth)
             .style("fill","none");
      }
    })

}

function edit_name() {
      var span = d3.select(this.parentNode).select('span'),
          oldname = span.text();
      span.text("");
      var input = span.append("input")
                    .attr("type","text")
                    .property("value",oldname),
          pencil = d3.select(this).style("display","none"),
          setVal = function() {
                var value = sanitize_names(input.property("value"));
                span.text(value);
                pencil.style("display",null);
          }
      input.on('keyup',function(){
          if ( d3.event.which == 13 && input.property("value")!="" ) {
              setVal();
          }
      });
      input.on('blur',function(){
          if ( input.property("value")!="" ) {
              setVal();
          } else {
              span.text(oldname);
              pencil.style("display",null);
          }
      });
      input.node().select();
}

function sanitize_names(value){
    return value.replace(/ /g,"_").replace(/[^a-zA-Z0-9\+\-\_]/g, "")
}

function input_autocomplete(id,wordlist,enterFunc){
  var input = d3.select("#"+id);

  input.on("keyup", search_autocomplete)
       .on("keydown", autocomplete_keydown)
       .on("click", function(){ this.select(); });

  d3.select(input.node().parentNode)
    .insert("ul","#"+id+" + *")
    .attr("id",id+"-list");

  var list = d3.select('#'+id+'-list');
  list.attr("class","autocomplete-list block-bordered hidden")
      .style("width",input.node().offsetWidth+"px")
      .on("click", function(){ d3.event.stopPropagation(); });

  function close_list(){
    var key = list.select("li.active").property("value"),
        text = list.select("li.active").text();
    if(!list.classed("hidden")){
      list.html("");
      list.classed("hidden",true);
      input.property("value",text);
      if(typeof enterFunc == "function"){
        enterFunc(+key);
        input.property("value","");
      }else{
        input.attr("key",key);
      }
    }
  }

  function autocomplete_keydown(){
    if(d3.event.which == 9 || d3.event.which == 13){
      close_list();
    }
  }

  function search_autocomplete(){
    if(d3.event.which == 13)
      return;
    if(d3.event.which == 38 || d3.event.which == 40){
      var li = list.selectAll('li');
      if(li.size() > 1){
        var current = 0;
        li.each(function(d,i){
          if(d3.select(this).classed("active"))
            current = i;
        });
        li.classed("active",false);
        if(d3.event.which == 38) current--;
        if(d3.event.which == 40) current++;
        if(current<0) current = li.size()-1;
        if(current>=li.size()) current = 0;
        li.filter(function (d, i) { return i === current; }).classed("active",true);
      }
      return;
    }
    list.html("");
    if ( this.value!="" ) {
      var i, val = this.value,
          len = val.length,
          selection = wordlist.filter(function(d){
            if(d[1].toLowerCase().indexOf(val.toLowerCase())!=-1)
              return true;
            return false;
          })
      if(selection.length){
        selection.forEach(function(d,i){
          list.append("li")
            .attr("class",!i?"active":null)
            .property("value",d[0])
            .text(d[1]+((d[2])?' ('+d[2]+')':''))
        });
      }else
        list.append("li").text("Not available.");
      list.selectAll('li').on("click",function(){
        list.select('li.active').classed("active",false);
        d3.select(this).classed("active",true);
        close_list();
      });
      list.classed("hidden",false);
    }else
      list.classed("hidden",true);
  }
}

function search_pattern_keydown(){
  if(d3.event.which == 9 || d3.event.which == 13){
    var self = d3.select(this),
        value = new RegExp(self.property("value"),'i');
    samples.forEach(function(d,i){
        d[1] = d[1] | d[0].match(value);
    });
    select_dots();
    self.property("value","");
  }
}

function input_multisearch(id,wordlist){
    var input = d3.select("#"+id).style("display","none");

    var searchSel = d3.select(input.node().parentNode).insert("div","#"+id)
        .attr("class","multi-search");

    var searchBox = searchSel.append("div")
      .attr("class","search-box")

    var checkContainer = searchBox.append("div")
      .attr("class","check-container")

    var typingTimer;
    var typingInterval = wordlist.length>1000 ? 1000 : 500; 

    var searchBoxInput = searchBox.append("div")
      .attr("class","text-wrapper")
      .on("click",function(){
        searchBoxInput.node().focus();
      })
      .append("div")
      .attr("class","text-content")
      .append("textarea")
        .attr("placeholder","Write variable names...")
        .on("focus",function(){
          searchBox.classed("focused",true);
        })
        .on("blur",function(){
          searchBox.classed("focused",false);
        })
        .on("keydown",function(){
          clearTimeout(typingTimer);
        })
        .on("keyup",function(){
          clearTimeout(typingTimer);
          if(d3.event.keyCode === 13){
            d3.event.stopPropagation();
          }
          if([37,38,39,40].indexOf(d3.event.keyCode)!=-1){
            return;
          }
          
          typingTimer = setTimeout(doneTyping, typingInterval);
        })

    function doneTyping () {
          var cutoff = wordlist.length>1000 ? 3 : 1,
              values = searchBoxInput.property("value").split("\n").filter(function(d){
                return d.length>=cutoff;
              });

          checkContainer.selectAll("span").remove();
          if(values.length){
            var valid = [];
            values.forEach(function(value){
              var found = false;
              value = new RegExp(value,'i');
              wordlist.forEach(function(word){
                if(String(word[1]).match(value)){
                  found = true;
                  valid.push(word[0]);
                }
              });
              checkContainer.append("span")
                .attr("class",found ? "yes": "no")
            });

            input.attr("key",valid.length ? valid.join(",") : null);
          }
    }
}

function getCluster(name){
    if(!samples)
      return;

    var data = d3.select("pre."+name+"_tsv");
    if(!data.empty()){
      data = data.text().split("\n").map(function(d){
        return d.split("\t").map(function(dd,i){
          var value = dd.split("|");
          if(i){
            return value.map(Number);
          }
          return value;
        });
      });
      data.pop();
      clusterData[name] = data;

      var index = d3.select("pre."+name+"_optim_cluster_txt");
      if(index.empty()){
        index = undefined;
      }else{
        index = index.text().trim();
      }
      list_cluster(name,index);
    }
}

function getDimReduction(name){
    if(!samples)
      return;

    var data = d3.select("pre."+name+"_csv");
    if(!data.empty()){
      data = data.text().split("\n");
      var labels = data.shift().split(",");
      data = data.map(function(d){ return d.split(",").map(function(e){ return +e }); });
      data.pop();
      dimData[name] = data;
      renderplot(name,data,labels[0],labels[1]);
    }
}

function save_json(){
  var json = {};
  d3.selectAll("body > div > pre").each(function(){
    var self = d3.select(this),
        name = self.attr("class"),
        txt = self.text();
    json[name] = txt.trim();
  })
  json['savedColors'] = savedColors;
  json['savedShapes'] = savedShapes;
  d3.selectAll(".div-plot[custom]").each(function(d,i){
    var custom = d3.select(this).attr("custom");
    json['newPlot_'+i] = String(custom);
  })
  if(heatmap.length){
    json['heatmap'] = String(heatmap.join(","));
  }
  if(violin!=-1){
    json['violin'] = String(violin);
  }
  downloadFile(d3.select("h2.editable > span").text()+".json",JSON.stringify(json));
}

function generate_report(){
  var doc = new jsPDF({
    orientation: 'p',
    unit: 'pt',
    format: 'a4',
    lineHeight: 1.2
  });

  var marginTop = 40,
      marginBottom = 20,
      marginLeft = 40,
      marginRight = 35,
      line = marginTop,
      pageHeight = doc.internal.pageSize.height,
      pageWidth = doc.internal.pageSize.width,
      contentWidth = pageWidth - marginRight - marginLeft,
      nextLine = function(d){
        line = line + d;
        if(line>=(pageHeight-marginBottom)){
          doc.addPage();
          line = marginTop;
        }
      };

  doc.setFontSize(20);
  doc.setTextColor(0);
  doc.text(marginLeft, line, d3.select("h2.editable span").text() + " Report")
  nextLine(24);
  doc.setFontSize(14);
  doc.text(marginLeft, line, dateFormat())
  nextLine(40);

  doc.text(marginLeft, line, "Input Samples");
  nextLine(8);

  doc.setFontSize(8);
  samples.forEach(function(d,i){
    nextLine(12);
    doc.text(marginLeft, line, i+1 + "\t" + d[0]);
  })

  var groups = d3.keys(myGroups).sort(),
      colorDots = true;
  if(groups.length){

    nextLine(40);
    doc.setFontSize(14);
    doc.text(marginLeft, line, "Defined Groups");

    groups.forEach(function(g,i){
      nextLine(20);
      doc.setFontSize(12);
      if(savedColors.hasOwnProperty(g + "_0"))
        doc.setTextColor(savedColors[g + "_0"]);
      else
        colorDots = false;
      doc.text(marginLeft, line, g);
      doc.setTextColor(0);
      nextLine(14);
      var lines = doc.setFontSize(8)
        .splitTextToSize(myGroups[g].map(function(e){ return samples[e][0]; }).join(", "), contentWidth)
      doc.text(marginLeft, line, lines);
      nextLine(lines.length*10);
    })
  }

  nextLine(30);

  var plotHeight = 300;

  var x = d3.scale.linear()
    .range([0, contentWidth]);

  var y = d3.scale.linear()
    .range([plotHeight, 0]);

  doc.setLineWidth(1);
  methodsDim.forEach(function(d){
    if(dimData.hasOwnProperty(d)){
      if(line+380>=(pageHeight-marginBottom)){
        doc.addPage();
        line = marginTop;
      }

      doc.setFontSize(16);
      doc.text(marginLeft, line, d);
      nextLine(20);
      doc.line(marginLeft,line,marginLeft,line+plotHeight)
      doc.line(marginLeft,line+plotHeight,marginLeft+contentWidth,line+plotHeight)
      x.domain(d3.extent(dimData[d],function(dd){ return dd[0]; }));
      y.domain(d3.extent(dimData[d],function(dd){ return dd[1]; }));
      doc.setFontSize(8);
      d3.selectAll("div."+d+" .x.axis .tick text").each(function(dd){
        var txt = d3.select(this).text(),
            xpos = marginLeft+x(+txt);
        if(xpos<pageWidth-marginRight){
          doc.line(xpos,line+plotHeight,xpos,line+plotHeight+5);
          doc.text(xpos,line+plotHeight+15,txt,{align:"center"});
        }
      })
      d3.selectAll("div."+d+" .y.axis .tick text").each(function(dd){
        var txt = d3.select(this).text(),
            ypos = line+y(+txt);
        doc.line(marginLeft-5,ypos,marginLeft,ypos);
        doc.text(marginLeft-7,ypos+2,txt,{align:"right"});
      })
      doc.setFontSize(6);
      dimData[d].forEach(function(dd,i){
        if(colorDots)
          doc.setFillColor(samples[i][2]);
        else
          doc.setFillColor(defaultColor);
        doc.circle(marginLeft+x(dd[0]), line+y(dd[1]), 3, 'F');
      })
      dimData[d].forEach(function(dd,i){
        doc.text(marginLeft+x(dd[0])+4, line+y(dd[1])+6, String(i+1));
      })
      nextLine(380);
    }
  })

  methodsCluster.forEach(function(d){
    if(clusterData.hasOwnProperty(d)){
      doc.setFontSize(16);
      doc.text(marginLeft, line, d + " Groups");
      nextLine(20);
      var ncluster = d3.select("div."+d+" i.ncluster");
      if(ncluster.empty()){
        ncluster = 0;
      }else{
        ncluster = +ncluster.text();
      }
      var clusters = getClustersFromData(d,ncluster);
      d3.keys(clusters).forEach(function(g,i){
        var dd = clusters[g].map(function(d){ return samples[d][0]; }).join(", ");
        var nameSpace = 50,
            lines = doc.setFontSize(8)
          .splitTextToSize(dd, contentWidth - nameSpace)
        doc.text(marginLeft, line, d + "_" + (i+1))
        doc.text(marginLeft + nameSpace, line, lines);
        nextLine((lines.length*10) + 6);
      })
      nextLine(20);
    }
  })

  doc.save("Report.pdf");
}

function zero_pad(n, width) {
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join('0') + n;
}

function dateFormat(time){
  var date = typeof time == "undefined" ? new Date() : new Date(time*1000),
      year = date.getFullYear(),
      month = date.getMonth()+1,
      day = date.getDate();

  return zero_pad(day,2) + "/" + zero_pad(month,2) + "/" + year;
}

function display_window(txt,width,height){
    var docSize = {width: window.innerWidth, height: window.innerHeight},
        bg = d3.select("body").append("div").attr("class","window-bg");
    bg.style("width",docSize.width+"px")
      .style("height", docSize.height+"px");

    if(typeof width == 'undefined'){
      width = docSize.width/2;
    }else if(width>docSize.width)
      width = docSize.width;

    if(typeof height == 'undefined'){
      height = docSize.height/2;
    }else if(height>docSize.height)
      height = docSize.height;

    var win = bg.append("div").attr("class","window")
      .style("margin-top", ((docSize.height-height)/2)+"px")
      .style("width", width+"px")
      .style("height", height+"px")
      .on("click",function(){ d3.event.stopPropagation(); });

    win.append("i")
      .attr("class","icon-cross_mark text-dark close-button")
      .on("click", function(){ bg.remove(); });

    win.append("div")
      .attr("class","window-content")
      .html(txt);
}

function downloadFile(filename, text) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function downloadExcel(data,name){
  var sheets = ["void"],
      contentTypes = [],
      workbook = [],
      workbookRels = [],
      sheetXML = function(dat){
        var xml = [];
        dat.forEach(function(d){
          xml.push('<row>');
          d.forEach(function(dd){
            if(typeof dd == 'number')
              xml.push('<c t="n"><v>'+dd+'</v></c>');
            else
              xml.push('<c t="inlineStr"><is><t>'+dd+'</t></is></c>');
          });
          xml.push('</row>');
        });
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="x14ac" xmlns:x14ac="http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac"><sheetData>'+xml.join('')+'</sheetData></worksheet>';
      }

  for(var d in data)
    sheets.push(d);

  var zip = new JSZip(),
      rels = zip.folder("_rels"),
      xl = zip.folder("xl"),
      xlrels = xl.folder("_rels"),
      xlworksheets = xl.folder("worksheets");

  rels.file(".rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');

  for(var i = 1; i < sheets.length; i++){
    contentTypes.push('<Override PartName="/xl/worksheets/sheet'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>');
    workbook.push('<sheet name="'+sheets[i]+'" sheetId="'+i+'" r:id="rId'+i+'"/>');
    workbookRels.push('<Relationship Id="rId'+i+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+i+'.xml"/>');
    xlworksheets.file("sheet"+i+".xml", sheetXML(data[sheets[i]]));
  }

  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="jpeg" ContentType="image/jpeg"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'+contentTypes.join('')+'</Types>');

  xl.file("workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><fileVersion appName="xl" lastEdited="5" lowestEdited="5" rupBuild="24816"/><workbookPr showInkAnnotation="0" autoCompressPictures="0"/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="25600" windowHeight="19020" tabRatio="500"/></bookViews><sheets>'+workbook.join('')+'</sheets></workbook>');

  xlrels.file("workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+workbookRels.join('')+'</Relationships>');

  zip.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"})
  .then(function(content) {
      fileDownload(content, name + '.xlsx');
  });
}
