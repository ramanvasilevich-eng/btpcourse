using ProcessorService as service from '../../srv/services';

annotate service.ListOfIncidents with @(
    UI.HeaderInfo : {
        TypeName       : 'Incident',
        TypeNamePlural : 'Incidents',
        Title : {
            $Type : 'UI.DataField',
            Value : title,
        },
    },
    UI.SelectionFields : [
        title,
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Value : ID,
            Label : 'ID',
        },
        {
            $Type : 'UI.DataField',
            Value : title,
            Label : '{i18n>Title}',
        },
        {
            $Type : 'UI.DataField',
            Value : customer.name,
            Label : '{i18n>Customer}',
        },
    ],
);