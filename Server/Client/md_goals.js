function Goals()
{ 
    this.goals = null;
}

Goals.method("onDataLoaded", function(claferXML, instancesXML){
    this.processor = new ClaferProcessor(claferXML);
    this.goals = this.processor.getGoals();
});

Goals.method("onRendered", function()
{
});

Goals.method("getContent", function()
{
	var td;
	
	var table = $('<table width="100%"></table>').addClass('goals');
	
	for (var i = 0; i < this.goals.length; i++)
	{
		var row = $('<tr></tr>').addClass('bar');
		td = $('<td id="operation_' + this.goals[i].operation + '"></td>').addClass('td_operation');
		td.html(this.goals[i].operation);
		row.append(td);
		
		td = $('<td></td>').addClass('td_argument');
		var span = $('<a href="#" draggable="true" ondragstart="drag(event)" id="' + this.goals[i].arg + '" class="' + this.goals[i].label + '"></a>');
		span.html(this.goals[i].label);
		td.append(span);
		row.append(td);
		$(table).append(row);
	}
    
    return table;
});
