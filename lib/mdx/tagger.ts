/**
 * Auto-tagging logic based on Azure keywords
 */

interface TagRule {
  keywords: string[];
  tags: string[];
}

const TAG_RULES: TagRule[] = [
  {
    keywords: ['front door', 'afd'],
    tags: ['Azure', 'Front Door', 'WAF']
  },
  {
    keywords: ['waf', 'owasp', 'web application firewall'],
    tags: ['Azure', 'WAF', 'Security']
  },
  {
    keywords: ['storage account', 'blob', 'sas', 'azure storage'],
    tags: ['Azure', 'Storage']
  },
  {
    keywords: ['private endpoint', 'private link'],
    tags: ['Azure', 'Networking', 'Private Link']
  },
  {
    keywords: ['nsg', 'network security group', 'udr', 'route table', 'user-defined route'],
    tags: ['Azure', 'Networking']
  },
  {
    keywords: ['expressroute', 'express route', 'bgp'],
    tags: ['Azure', 'Networking', 'ExpressRoute']
  },
  {
    keywords: ['application gateway', 'app gateway', 'appgw'],
    tags: ['Azure', 'Application Gateway']
  },
  {
    keywords: ['key vault', 'akv'],
    tags: ['Azure', 'Key Vault', 'Security']
  },
  {
    keywords: ['app service', 'web app'],
    tags: ['Azure', 'App Service']
  },
  {
    keywords: ['virtual machine', 'vm'],
    tags: ['Azure', 'Virtual Machines']
  },
  {
    keywords: ['kubernetes', 'aks', 'k8s'],
    tags: ['Azure', 'AKS', 'Kubernetes']
  },
  {
    keywords: ['function', 'functions app', 'azure functions'],
    tags: ['Azure', 'Functions']
  },
  {
    keywords: ['cosmos', 'cosmosdb'],
    tags: ['Azure', 'Cosmos DB', 'Database']
  },
  {
    keywords: ['sql database', 'azure sql'],
    tags: ['Azure', 'SQL Database']
  },
  {
    keywords: ['vnet', 'virtual network', 'subnet'],
    tags: ['Azure', 'Networking', 'VNet']
  },
  {
    keywords: ['load balancer', 'lb'],
    tags: ['Azure', 'Load Balancer', 'Networking']
  },
  {
    keywords: ['vpn', 'vpn gateway'],
    tags: ['Azure', 'VPN Gateway', 'Networking']
  },
  {
    keywords: ['dns', 'azure dns'],
    tags: ['Azure', 'DNS', 'Networking']
  },
  {
    keywords: ['monitor', 'application insights', 'log analytics'],
    tags: ['Azure', 'Monitoring']
  },
  {
    keywords: ['rbac', 'role-based access', 'iam'],
    tags: ['Azure', 'Security', 'RBAC']
  }
];

/**
 * Extract tags from raw text based on keyword matching
 */
export function extractTags(text: string): string[] {
  const lowerText = text.toLowerCase();
  const tagSet = new Set<string>();
  
  // Check if any Azure-related keywords appear
  const hasAzureContext = /azure|microsoft|subscription|resource group/i.test(text);
  
  // Apply tag rules
  for (const rule of TAG_RULES) {
    for (const keyword of rule.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        rule.tags.forEach(tag => tagSet.add(tag));
        break;
      }
    }
  }
  
  // Always add "Azure" if we detected Azure context
  if (hasAzureContext) {
    tagSet.add('Azure');
  }
  
  // Return unique tags, with "Azure" first if present
  const tags = Array.from(tagSet);
  tags.sort((a, b) => {
    if (a === 'Azure') return -1;
    if (b === 'Azure') return 1;
    return a.localeCompare(b);
  });
  
  return tags.length > 0 ? tags : ['Azure', 'General'];
}
