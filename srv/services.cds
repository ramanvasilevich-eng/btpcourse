using {sap.capire.incidents as my} from '../db/schema';

/**
 * Service used by support personell, i.e. the incidents' 'processors'.
 */
service ProcessorService {
    @cds.redirection.target
    entity Incidents as projection on my.Incidents;

    @readonly
    entity Customers as projection on my.Customers;

    @readonly
    entity ListOfIncidents as projection on my.ListOfIncidents;
}

annotate ProcessorService.Incidents with @odata.draft.enabled; 

/**
 * Service used by administrators to manage customers and incidents.
 */
service AdminService {
    entity Customers as projection on my.Customers;
    entity Incidents as projection on my.Incidents;
}
