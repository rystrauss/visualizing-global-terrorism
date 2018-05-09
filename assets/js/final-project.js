let zoom = d3.zoom()
    .scaleExtent([1, 9])
    .on("zoom", move);

let c = document.getElementById('container');
let width = c.offsetWidth;
let height = width / 2;

//offsets for tooltips
let offsetL = c.offsetLeft + 20;
let offsetT = c.offsetTop + 10;

let topo, projection, path, svg, g;

let tooltip = d3.select("#container").append("div").attr("class", "tooltip hidden");

let color = d3.scaleOrdinal(d3.schemeCategory10);

//Scale for dit size
let sizeScale = d3.scaleLinear();

//Time parsers
let parseTime = d3.timeParse("%Y-%m-%d");
let parseYear = d3.timeParse("%Y");

let attackType, startDate, endDate;

//variables for line chart
let lineSVG = d3.select("#line-chart"),
    margin = {
        top: 20,
        right: 80,
        bottom: 30,
        left: 50
    },
    linewidth = lineSVG.attr("width") - margin.left - margin.right,
    lineheight = lineSVG.attr("height") - margin.top - margin.bottom - 150,
    g2 = lineSVG.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

let x = d3.scaleTime().range([0, linewidth]),
    y = d3.scaleLinear().range([lineheight, 0]),
    z = d3.scaleOrdinal(d3.schemeCategory10);

let line = d3.line()
    .curve(d3.curveLinear)
    .x(function (d) {
        return x(d.key);
    })
    .y(function (d) {
        return y(d.value);
    });


//variables for bar chart
let svgBar = d3.select("#bar-chart"),
    marginBar = {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
    },
    widthBar = +svgBar.attr("width") - marginBar.left - marginBar.right,
    heightBar = +svgBar.attr("height") - marginBar.top - marginBar.bottom - 150,
    gBar = svgBar.append("g").attr("transform", "translate(" + marginBar.left + "," + marginBar.top + ")");

let xBar = d3.scaleBand()
    .rangeRound([0, widthBar])
    .paddingInner(0.05)
    .align(0.1);

let yBar = d3.scaleLinear()
    .rangeRound([heightBar, 0]);


setup(width, height);

function setup(width, height) {
    projection = d3.geoMercator()
        .translate([(width / 2), (height / 2)])
        .scale(width / 2 / Math.PI);

    path = d3.geoPath().projection(projection);

    svg = d3.select("#container").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .append("g");

    g = svg.append("g")
        .on("click", click);

}

d3.queue()
    .defer(d3.json, "assets/data/world-topo-min.json")
    .defer(d3.csv, "assets/data/attacks.csv")
    .await(ready);

function ready(error, world, data) {
    if (error) throw error;

    //filter data
    data = data.filter(function (d) {
        return d["success"] === "1" && +d["nkill"] > 0 && +d["attacktype1"] !== 9;
    });

    data.forEach(function (d) {
        d["formattedDate"] = parseTime(d["iyear"] + "-" + d["imonth"] + "-" + d["iday"]);
    });

    let currData = data;

    attackType = "All Attack Types";
    startDate = parseYear("1970");
    endDate = parseYear("2016");

    let attackTypes = d3.set(data, function (d) {
        return d["attacktype1_txt"];
    }).values();

    sizeScale.domain(d3.extent(data, function (d) {
        return +d["nkill"];
    }));
    sizeScale.range([2, 16]);

    topo = topojson.feature(world, world.objects.countries).features;

    draw(topo);

    data.forEach(function (d) {
        addpoint(d);
    });

    //create legend
    let color = d3.scaleOrdinal(d3.schemeCategory10);
    color.domain(attackTypes);
    let svg = d3.select("#legend");
    let svg2 = d3.select("#legendSize");
    svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(20,20)");
    svg2.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(20,20)");
    let legend = d3.legendColor()
        .shape("path", d3.symbol().type(d3.symbolCircle).size(150)())
        .shapePadding(10)
        .scale(color)
        .title("Type of Attack");
    let legendSize = d3.legendSize()
        .shape("circle")
        .shapePadding(10)
        .scale(sizeScale)
        .cells(6)
        .orient("vertical")
        .title("Number of Deaths");
    svg.select(".legend")
        .call(legend);
    svg2.select(".legend")
        .call(legendSize);

    attackTypes.unshift("All Attack Types");

    //create radio buttons
    d3.select("#AttackDiv").selectAll("input")
        .data(attackTypes)
        .enter()
        .append("label")
        .text(function (d) {
            return d;
        })
        .insert("input")
        .attr("type", "radio")
        .attr("value", function (d) {
            return d;
        })
        .property("checked", function (d) {
            return d === "All Attack Types";
        })
        .attr("name", "attackRadio")
        .on("change", function (d) {
            attackType = d;
            updateGraph();
        });

    //filter by range
    d3.select("#yearRange")
        .on("submit", function () {
            let temp1 = document.getElementById("startYear").value;
            let temp2 = document.getElementById("endYear").value;
            if (+temp1 >= 1970 && +temp2 <= 2016 && +temp1 - +temp2 <= 0) {
                startDate = parseYear(temp1);
                endDate = parseYear(+temp2 + 1);
                updateGraph();
            } else {
                alert("Please enter years between 1970 and 2016.");
            }
        });

    //animation
    let nestedData = [];
    let cYear = $("#cYear");

    d3.select("#animate")
        .on("click", function () {
            let currDate = startDate;
            cYear.html(currDate.getFullYear());
            d3.selectAll(".gpoint").remove();
            nestedData = d3.nest()
                .key(function (d) {
                    return formatDate(d["formattedDate"]);
                })
                .entries(currData);
            nestedData = nestedData.sort(function (a, b) {
                let aYear = +a.key.substring(0, 4);
                let aMonth = +a.key.substring(5);
                let bYear = +b.key.substring(0, 4);
                let bMonth = +b.key.substring(5);
                return (aYear < bYear) ? -1 : (aYear > bYear) ? 1 : ((aMonth < bMonth) ? -1 : (aMonth > bMonth) ? 1 : 0);
            });
            nestedData = nestedData.filter(function (v) {
                return +v.key.substring(0, 4) >= +startDate.getFullYear();
            });
            setTimeout(function () {
                animateUpdate(currDate, 0);
            }, 4)
        });

    function animateUpdate(currDate, index) {
        if (index >= nestedData.length || currDate > endDate) {
            let temp1 = document.getElementById("startYear").value;
            let temp2 = document.getElementById("endYear").value;
            if (+temp1 >= 1970 && +temp2 <= 2016 && +temp1 - +temp2 <= 0) {
                startDate = parseYear(temp1);
                endDate = parseYear(+temp2 + 1);
                updateGraph();
            } else {
                alert("Please enter years between 1970 and 2016.");
            }
            return;
        }
        if (nestedData[index].key === formatDate(currDate)) {
            nestedData[index].values.forEach(function (d) {
                addpoint(d);
            });
            index += 1;
        }
        cYear.html(currDate.getFullYear());
        currDate.setMonth(currDate.getMonth() + 1);
        setTimeout(function () {
            animateUpdate(currDate, index);
        }, 4);
    }

    function formatDate(d) {
        return d.getFullYear() + "-" + d.getMonth();
    }

    //update graph based on selections
    function updateGraph() {
        d3.selectAll(".gpoint").remove();
        if (attackType === "All Attack Types") {
            currData = data.filter(function (d) {
                return d["formattedDate"] >= startDate && d["formattedDate"] <= endDate;
            })
        } else {
            currData = data.filter(function (d) {
                return d["attacktype1_txt"] === attackType && d["formattedDate"] >= startDate && d["formattedDate"] <= endDate;
            })
        }
        currData.forEach(function (d) {
            addpoint(d);
        });

        let newAttackNestedData = d3.nest()
            .key(function (d) {
                return d["attacktype1_txt"];
            })
            .key(function (d) {
                return d["formattedDate"].getFullYear() + "-" + d["formattedDate"].getMonth() + "-" + d["formattedDate"].getDay();
            })
            .rollup(function (d) {
                return d3.sum(d, function (v) {
                    return v["nkill"];
                });
            })
            .entries(currData);

        newAttackNestedData.forEach(function (d) {
            for (let i = 1; i < d.values.length; i += 1) {
                d.values[i].value += d.values[i - 1].value;
            }
        });

        newAttackNestedData.forEach(function (d) {
            d.values.forEach(function (v) {
                v["key"] = parseTime(v["key"]);
            })
        });

        x.domain([startDate, endDate]);
        y.domain([0, d3.max(newAttackNestedData, function (d) {
            return d.values[d.values.length - 1].value;
        })]);

        g2.selectAll("g").remove();

        g2.append("g")
            .attr("class", "axis axis--x")
            .attr("transform", "translate(0," + lineheight + ")")
            .call(d3.axisBottom(x))
            .append("text")
            .attr("y", 50)
            .attr("x", linewidth / 2)
            .attr("fill", "#000")
            .style("font-weight", "bold")
            .text("Time");

        g2.append("g")
            .attr("class", "axis axis--y")
            .call(d3.axisLeft(y))
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", "0.71em")
            .attr("fill", "#000")
            .style("font-weight", "bold")
            .text("Cumulative Number of Deaths by Attack Type");

        g2.append("text")
            .attr("text-anchor", "middle")
            .attr("y", 1)
            .attr("x", linewidth / 2)
            .attr("fill", "#000")
            .style("font-weight", "bold")
            .style("text-decoration", "underline")
            .text("Number of Deaths Over Time by Attack Type");

        let attack = g2.selectAll(".Attack")
            .data(newAttackNestedData)
            .enter().append("g")
            .attr("class", "attack");

        attack.append("path")
            .attr("class", "line")
            .attr("d", function (d) {
                return line(d.values);
            })
            .style("stroke", function (d) {
                return z(d.key);
            });
    }

    //line graph
    let attackNestedData = d3.nest()
        .key(function (d) {
            return d["attacktype1_txt"];
        })
        .key(function (d) {
            return d["formattedDate"].getFullYear() + "-" + d["formattedDate"].getMonth() + "-" + d["formattedDate"].getDay();
        })
        .rollup(function (d) {
            return d3.sum(d, function (v) {
                return v["nkill"];
            });
        })
        .entries(currData);

    attackNestedData.forEach(function (d) {
        for (let i = 1; i < d.values.length; i += 1) {
            d.values[i].value += d.values[i - 1].value;
        }
    });

    attackNestedData.forEach(function (d) {
        d.values.forEach(function (v) {
            v["key"] = parseTime(v["key"]);
        })
    });

    x.domain([startDate, endDate]);
    y.domain([0, d3.max(attackNestedData, function (d) {
        return d.values[d.values.length - 1].value;
    })]);

    g2.append("g")
        .attr("class", "axis axis--x")
        .attr("transform", "translate(0," + lineheight + ")")
        .call(d3.axisBottom(x))
        .append("text")
        .attr("y", 50)
        .attr("x", linewidth / 2)
        .attr("fill", "#000")
        .style("font-weight", "bold")
        .text("Time");

    g2.append("g")
        .attr("class", "axis axis--y")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", "0.71em")
        .attr("fill", "#000")
        .style("font-weight", "bold")
        .text("Cumulative Number of Deaths by Attack Type");

    g2.append("text")
        .attr("text-anchor", "middle")
        .attr("y", 1)
        .attr("x", linewidth / 2)
        .attr("fill", "#000")
        .style("font-weight", "bold")
        .style("text-decoration", "underline")
        .text("Number of Deaths Over Time by Attack Type");

    let attack = g2.selectAll(".Attack")
        .data(attackNestedData)
        .enter().append("g")
        .attr("class", "attack");

    attack.append("path")
        .attr("class", "line")
        .attr("d", function (d) {
            return line(d.values);
        })
        .style("stroke", function (d) {
            return z(d.key);
        });


    let targetNestedData = d3.nest()
        .key(function (d) {
            return d["targtype1_txt"];
        })
        .key(function (d) {
            return d["attacktype1_txt"];
        })
        .rollup(function (d) {
            return d.length;
        })
        .entries(currData);

    let keys = d3.set();

    targetNestedData.forEach(function (d) {
        let sum = 0;
        d.values.forEach(function (v) {
            d[v.key] = v.value;
            sum += v.value;
            keys.add(v.key);
        });
        delete(d.values);
        d["total"] = sum;
    });

    let keysBar = keys.values();

    targetNestedData.sort(function (a, b) {
        return b.total - a.total;
    });
    xBar.domain(targetNestedData.map(function (d) {
        return d.key;
    }));
    yBar.domain([0, d3.max(targetNestedData, function (d) {
        return d.total;
    })]).nice();

    gBar.append("g")
        .selectAll("g")
        .data(d3.stack().keys(keysBar)(targetNestedData))
        .enter().append("g")
        .attr("fill", function (d) {
            return z(d.key);
        })
        .selectAll("rect")
        .data(function (d) {
            return d;
        })
        .enter().append("rect")
        .attr("x", function (d) {
            return xBar(d.data.key);
        })
        .attr("y", function (d) {
            return yBar(d[1]);
        })
        .attr("height", function (d) {
            return yBar(d[0]) - yBar(d[1]);
        })
        .attr("width", xBar.bandwidth());

    gBar.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + heightBar + ")")
        .call(d3.axisBottom(xBar))
        .selectAll("text")
        .style("text-anchor", "start")
        .attr("transform", "rotate(90)")
        .attr("dy", "-0.6em")
        .attr("dx", "1em");

    gBar.append("text")
        .attr("y", 850)
        .attr("x", linewidth / 2)
        .attr("fill", "#000")
        .style("font-weight", "bold")
        .style("font-size", 10)
        .text("Target Type");

    gBar.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yBar).ticks(null, "s"))
        .append("text")
        .attr("x", 2)
        .attr("y", yBar(yBar.ticks().pop()) + 0.5)
        .attr("dy", "0.32em")
        .attr("fill", "#000")
        .attr("font-weight", "bold")
        .attr("text-anchor", "start")
        .text("Number of Attacks");

    gBar.append("text")
        .attr("text-anchor", "middle")
        .attr("y", 1)
        .attr("x", widthBar / 2)
        .attr("fill", "#000")
        .style("font-weight", "bold")
        .style("text-decoration", "underline")
        .text("Number of Terror Events by Target and Attack Type");

    let legendBar = gBar.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "end")
        .selectAll("g")
        .data(keysBar.slice().reverse())
        .enter().append("g")
        .attr("transform", function (d, i) {
            return "translate(0," + i * 20 + ")";
        });

    legendBar.append("rect")
        .attr("x", widthBar - 19)
        .attr("width", 19)
        .attr("height", 19)
        .attr("fill", z);

    legendBar.append("text")
        .attr("x", widthBar - 24)
        .attr("y", 9.5)
        .attr("dy", "0.32em")
        .text(function (d) {
            return d;
        });


}

function handleMouseOver() {
    let mouse = d3.mouse(svg.node()).map(function (d) {
        return parseInt(d);
    });

    tooltip.classed("hidden", false)
        .attr("style", "left:" + (mouse[0] + offsetL) + "px;top:" + (mouse[1] + offsetT) + "px")
        .html(this.__data__.properties.name);
}

function handleMouseOut() {
    tooltip.classed("hidden", true);
}

function draw(topo) {

    let country = g.selectAll(".country").data(topo);

    country.enter().insert("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("id", function (d) {
            return d.id;
        })
        .attr("title", function (d) {
            return d.properties.name;
        })
        .style("fill", "#f9f9f9")
        .on("mouseover", handleMouseOver)
        .on("mouseout", handleMouseOut);
}

function move() {

    //let t = d3.event.translate;
    let t = [d3.event.transform.x, d3.event.transform.y];
    //let s = d3.event.scale; 
    let s = d3.event.transform.k;
    zscale = s;
    let h = height / 4;

    t[0] = Math.min(
        (width / height) * (s - 1),
        Math.max(width * (1 - s), t[0])
    );

    t[1] = Math.min(
        h * (s - 1) + h * s,
        Math.max(height * (1 - s) - h * s, t[1])
    );

    //zoom.translateBy(t);
    g.attr("transform", "translate(" + t + ")scale(" + s + ")");

    //adjust the country hover stroke width based on zoom level
    d3.selectAll(".country").style("stroke-width", 1 / s);

}

//geo translation on mouse click in map
function click() {
    projection.invert(d3.mouse(this));
}


//function to add points and text to the map (used in plotting capitals)
function addpoint(d) {
    let lon = +d["longitude"];
    let lat = +d["latitude"];
    let gpoint = g.append("g").attr("class", "gpoint");
    let x = projection([lon, lat])[0];
    let y = projection([lon, lat])[1];

    gpoint.append("svg:circle")
        .attr("cx", x)
        .attr("cy", y)
        .attr("class", "point")
        .attr("r", sizeScale(d["nkill"]))
        .attr("fill", color(d["attacktype1_txt"]))
        .attr("fill-opacity", 0.2);
}
