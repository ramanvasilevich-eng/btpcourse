const cds = require('@sap/cds')

class ProcessorService extends cds.ApplicationService {
  /** Registering custom event handlers */
  async init() {
    this.before("UPDATE", "Incidents", (req) => this.onUpdate(req));
    this.before("CREATE", "Incidents", (req) => this.changeUrgencyDueToSubject(req.data));
    this.after("READ", "Incidents", (data, req) => this.getCustomers(data, req));
    this.on('READ', 'Customers', (req) => this.onCustomerRead(req));
    this.on(['CREATE','UPDATE'], 'Incidents', (req, next) => this.onCustomerCache(req, next));
    this.S4bupa = await cds.connect.to('API_BUSINESS_PARTNER');
    this.remoteService = await cds.connect.to('RemoteService');

    return super.init();
  }

  async onCustomerCache(req, next) {
    const { Customers } = this.entities;
    const newCustomerId = req.data.customer_ID;
    const result = await next();
    if (newCustomerId && newCustomerId !== "") {
      console.log('>> CREATE or UPDATE customer!');

      try {
        // Use direct path-based access /A_BusinessPartner('id') instead of $filter,
        // because Sandbox API often returns 500 on $filter queries with $top=1.
        const customer = await this.S4bupa.send({
          method: 'GET',
          path: `/A_BusinessPartner('${newCustomerId}')?$select=BusinessPartner,FirstName,LastName,BusinessPartnerName`
        });

        if (customer) {
          const entry = {
            ID: customer.BusinessPartner,
            firstName: customer.FirstName || '',
            lastName: customer.LastName || ''
          };
          // For organizations (no first/last name) put the full name into firstName
          // so the computed `name` field in local Customers shows correctly.
          if (!entry.firstName && !entry.lastName && customer.BusinessPartnerName) {
            entry.firstName = customer.BusinessPartnerName;
          }
          await UPSERT.into(Customers).entries(entry);
          console.log('>> cached customer:', entry);
        }
      } catch (err) {
        console.warn(`>> Failed to cache customer ${newCustomerId}: ${err.message}`);
        // Fallback: at least save the ID so UI doesn't show empty
        try {
          await UPSERT.into(Customers).entries({ ID: newCustomerId });
        } catch {}
      }
    }
    return result;
  }

  async onCustomerRead(req) {
    console.log('>> delegating to S4 service...', req.query);
    const top = parseInt(req._queryOptions?.$top) || 100;
    const skip = parseInt(req._queryOptions?.$skip) || 0;

    const { BusinessPartner } = this.remoteService.entities;

    // Detect single-entity read by key (e.g. /Customers('1000032'))
    const cqn = req.query.SELECT;
    const where = cqn?.where;
    const isOne = cqn?.one;
    let customerId = null;
    if (where && Array.isArray(where)) {
      // where looks like [ { ref: ['ID'] }, '=', { val: '1000032' } ]
      for (let i = 0; i < where.length; i++) {
        if (where[i]?.ref?.[0] === 'ID' && where[i + 2]?.val) {
          customerId = where[i + 2].val;
          break;
        }
      }
    }

    // Build the query
    let query = SELECT.from(BusinessPartner, bp => {
      bp.ID,
      bp.firstName,
      bp.lastName,
      bp.name,
      bp.addresses(address => {
        address.email(emails => {
          emails.email;
        });
      })
    });

    if (customerId) {
      query = query.where({ ID: customerId });
      if (isOne) query.SELECT.one = true;
    } else {
      query = query.limit(top, skip);
    }

    let result = await this.S4bupa.run(query);

    const mapBP = (bp) => ({
      ID: bp.ID,
      name: bp.name,
      email: bp.addresses?.[0]?.email?.[0]?.email
    });

    if (isOne || customerId) {
      // single entity result
      const single = Array.isArray(result) ? result[0] : result;
      return single ? mapBP(single) : null;
    }

    result = result.map(mapBP);
    // Explicitly set $count so the values show up in the value help in the UI
    result.$count = 1000;
    console.log("after result", result);
    return result;
  }

  changeUrgencyDueToSubject(data) {
    let urgent = data.title && data.title.match(/urgent/i)
    if (urgent) data.urgency_code = 'H'
  }

  async getCustomers(data, req) {
    const customers = await SELECT.from('ProcessorService.Customers')
    console.log('Customers:', customers)
  }

  /** Custom Validation */
  async onUpdate (req) {
    debugger
    let closed = await SELECT.one(1) .from (req.subject) .where `status.code = 'C'`
    if (closed) req.reject `Can't modify a closed incident!`
  }
}

class AdminService extends cds.ApplicationService {
  async init() {
    this.northwind = await cds.connect.to('Northwind');
    this.northwindBTP = await cds.connect.to('Northwind_BTP');

    this.before('CREATE', 'Items', (req) => {
      if (req.data.quantity > 100) req.reject(400, 'Quantity cannot exceed 100')
    })
    this.on('getItemsByQuantity', async (req) => {
      const { quantity } = req.data
      return SELECT.from('AdminService.Items').where({ quantity })
    })
    this.on('createItem', async (req) => {
      const { title, descr, quantity } = req.data
      if (quantity > 100) req.reject(400, 'Quantity cannot exceed 100')
      const ID = cds.utils.uuid()
      await INSERT.into('AdminService.Items').entries({ ID, title, descr, quantity })
      return SELECT.one('AdminService.Items').where({ ID })
    })
    this.on('getOrders', async () => {
      return this.northwind.send('GET', '/Orders?$top=20');
    })
    this.on('getOrdersBTP', async () => {
      return this.northwindBTP.send('GET', '/Orders?$top=20');
    })
    return super.init()
  }
}
module.exports = { ProcessorService, AdminService }
