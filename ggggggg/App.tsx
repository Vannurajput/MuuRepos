import React, { useState, useEffect, useCallback, useMemo } from 'react';

// Define the interface for the external message handler
declare global {
  interface Window {
    externalMessage?: {
      send: (message: string) => any;
    };
    // Global helper for the Muul browser to inject results directly
    updateBrowserResult?: (data: any) => void;
  }
}

// --- Type Definitions for Folder Structure ---
interface FileNode {
  name: string;
  isDirectory: false;
  size: number;
}

interface FolderNode {
  name: string;
  isDirectory: true;
  size?: 'Size not available';
  children: (FileNode | FolderNode)[];
}

type FilesystemNode = FileNode | FolderNode;

// --- Recursive Folder Tree Component ---
const FolderTreeView: React.FC<{ node: FilesystemNode; level?: number }> = ({ node, level = 0 }) => {
  const isDirectory = node.isDirectory;
  const indentStyle = { paddingLeft: `${level * 24}px` };

  return (
    <div className="text-sm font-mono">
      <div style={indentStyle} className="flex items-center gap-2 py-1 hover:bg-gray-100 rounded">
        <span className="text-lg">{isDirectory ? '📁' : '📄'}</span>
        <span className="flex-1 text-gray-800">{node.name}</span>
        <span className="text-xs text-gray-500 pr-2">
          {isDirectory ? (node.size || 'Size not available') : `${node.size} bytes`}
        </span>
      </div>
      {isDirectory && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FolderTreeView key={`${child.name}-${index}`} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};


const PRINT_JSON = {
  "type": "print",
  "payload": {
    "printer_name": ["EPSON TM-m30 Receipt"],
    "item_length": 26,
    "template": "2",
    "data": [
      {
        "type": "logo",
        "data": {
          "url": "https://mis.rezolpos.in/images/print_logo/BBK-POS-NEW.jpg"
        }
      },
      {
        "type": "header",
        "data": {
          "top_title": "My Store Name",
          "bill_no": "13355",
          "date_of_bill": "3/3/2022"
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "item",
        "data": {
          "itemdata": [
            {
              "item_name": "Pizza",
              "quantity": 1,
              "price": 44.99,
              "item_amount": 44.99
            }
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "bigsummary",
        "data": {
          "bigsummary": [
            {
              "key": "Total",
              "value": 44.99
            }
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "footer",
        "data": {
          "align": "center",
          "footer_text": ["Thank you for your visit!"]
        }
      }
    ]
  }
};

const PRINT_JSON_2 = {
	"type": "print",
	"payload": {
		"printer_name": [
			"EPSON TM-m30 Receipt"
		],
		"item_length": 31,
		"template": "2",
		"data": [
			{
				"type": "logo",
				"data": {
					"url": "https://app.esmartpos.com//assets//POS//logo//853560e6414b03d20c64a2ce9b1fc923.png"
				}
			},
			{
				"type": "summary",
				"data": {
					"summary": [
						{
							"key": "Subtotal",
							"value": 91.95
						}
					]
				}
			},
			{
				"type": "header",
				"data": {
					"top_title": "",
					"sub_titles": [
						"Title 1",
						"Title 2"
					],
					"address": [
						"#122 downtown"
					],
					"bill_no": "13355",
					"ticket_no": "10",
					"date_of_bill": "3/3/2022",
					"prepration_date": "",
					"time": "11:32 AM",
					"print": "",
					"table": "",
					"online_order_id": "",
					"employee": "User 1",
					"till": "Terminal 2",
					"order_type": "Dine In",
					"customer_name": "",
					"customer_phone": "",
					"customer_address": [
						"hahaha"
					],
					"customer_remarks": [
						"hahaha"
					],
					"split_bill_string": "",
					"headercomments": [
						"hahaha"
					]
				}
			},
			{
				"type": "separator",
				"data": {
					"separator_length": ""
				}
			},
			{
				"type": "item",
				"data": {
					"itemdata": [
						{
							"order_invoice_id": 13309,
							"item_amount": 46.98,
							"item_name": "Orchard Special 3 pizza 1",
							"item_subLine": "",
							"toppings_with_price": [
								"hahaha"
							],
							"toppings": [
								"Sugar",
								"Extra salt",
								"Cheese"
							],
							"quantity": 1,
							"selected": false,
							"price": 44.99,
							"custpmer_remarks": "",
							"printer_name": "",
							"printer_label": "",
							"station": "",
							"food_stampable": "",
							"items": [
								{
									"order_invoice_id": "",
									"item_amount": 0,
									"item_name": "Garlic Bread 1 ",
									"item_subLine": "",
									"toppings_with_price": [
										"hahaha"
									],
									"toppings": [
										"fg"
									],
									"quantity": 0,
									"selected": false,
									"price": 0,
									"custpmer_remarks": "",
									"printer_name": "",
									"printer_label": "",
									"station": "",
									"food_stampable": "",
									"items": [
										"we"
									],
									"print_description": "",
									"deleted": false,
									"exists": false,
									"display_index": 0,
									"is_printed": false,
									"made_to": false,
									"menu_group": [
										"hahaha"
									],
									"kitchen_print": false
								}
							],
							"print_description": "",
							"deleted": false,
							"exists": false,
							"display_index": 0,
							"is_printed": false,
							"made_to": false,
							"menu_group": "Combo~10",
							"kitchen_print": false
						},
						{
							"order_invoice_id": 13309,
							"item_amount": 46.98,
							"item_name": "French fire",
							"item_subLine": "",
							"toppings_with_price": [
								"hahaha"
							],
							"toppings": [],
							"quantity": 1,
							"selected": false,
							"price": 44.99,
							"custpmer_remarks": "",
							"printer_name": "",
							"printer_label": "",
							"station": "",
							"food_stampable": "",
							"items": [
								{
									"order_invoice_id": "",
									"item_amount": 0,
									"item_name": "Render mest",
									"item_subLine": "",
									"toppings_with_price": [
										"hahaha"
									],
									"toppings": [
										"Salt",
										"Extra sauce",
										"Chilli"
									],
									"quantity": 0,
									"selected": false,
									"price": 0,
									"custpmer_remarks": "",
									"printer_name": "",
									"printer_label": "",
									"station": "",
									"food_stampable": "",
									"items": [
										"we"
									],
									"print_description": "",
									"deleted": false,
									"exists": false,
									"display_index": 0,
									"is_printed": false,
									"made_to": false,
									"menu_group": [
										"hahaha"
									],
									"kitchen_print": false
								}
							],
							"print_description": "",
							"deleted": false,
							"exists": false,
							"display_index": 0,
							"is_printed": false,
							"made_to": false,
							"menu_group": "Combo~10",
							"kitchen_print": false
						}
					]
				}
			},
			{
				"type": "separator",
				"data": {
					"separator_length": ""
				}
			},
			{
				"type": "bigsummary",
				"data": {
					"bigsummary": [
						{
							"key": "Subtotal",
							"value": 91.95
						},
						{
							"key": "Total",
							"value": 43.96
						},
						{
							"key": "PaidAmount",
							"value": 43.96
						},
						{
							"key": "TaxTotal",
							"value": 5.73
						}
					]
				}
			},
			{
				"type": "separator",
				"data": {
					"separator_length": ""
				}
			},
			{
				"type": "item",
				"data": {
					"itemdata": [
						{
							"order_invoice_id": 13309,
							"item_amount": 46.98,
							"item_name": "Orchard Special 3 pizza",
							"item_subLine": "",
							"toppings_with_price": [
								"hahaha"
							],
							"toppings": [
								"Sugar",
								"Extra salt",
								"Cheese"
							],
							"quantity": 1,
							"selected": false,
							"price": 44.99,
							"custpmer_remarks": "",
							"printer_name": "",
							"printer_label": "",
							"station": "",
							"food_stampable": "",
							"items": [
								{
									"order_invoice_id": "",
									"item_amount": 0,
									"item_name": "Garlic Bread 1 ",
									"item_subLine": "",
									"toppings_with_price": [
										"hahaha"
									],
									"toppings": [
										"fg"
									],
									"quantity": 0,
									"selected": false,
									"price": 0,
									"custpmer_remarks": "",
									"printer_name": "",
									"printer_label": "",
									"station": "",
									"food_stampable": "",
									"items": [
										"we"
									],
									"print_description": "",
									"deleted": false,
									"exists": false,
									"display_index": 0,
									"is_printed": false,
									"made_to": false,
									"menu_group": [
										"hahaha"
									],
									"kitchen_print": false
								}
							],
							"print_description": "",
							"deleted": false,
							"exists": false,
							"display_index": 0,
							"is_printed": false,
							"made_to": false,
							"menu_group": "Combo~10",
							"kitchen_print": false
						},
						{
							"order_invoice_id": 13309,
							"item_amount": 46.98,
							"item_name": "French fire",
							"item_subLine": "",
							"toppings_with_price": [
								"hahaha"
							],
							"toppings": [],
							"quantity": 1,
							"selected": false,
							"price": 44.99,
							"custpmer_remarks": "",
							"printer_name": "",
							"printer_label": "",
							"station": "",
							"food_stampable": "",
							"items": [
								{
									"order_invoice_id": "",
									"item_amount": 0,
									"item_name": "Render mest",
									"item_subLine": "",
									"toppings_with_price": [
										"hahaha"
									],
									"toppings": [
										"Salt",
										"Extra sauce",
										"Chilli"
									],
									"quantity": 0,
									"selected": false,
									"price": 0,
									"custpmer_remarks": "",
									"printer_name": "",
									"printer_label": "",
									"station": "",
									"food_stampable": "",
									"items": [
										"we"
									],
									"print_description": "",
									"deleted": false,
									"exists": false,
									"display_index": 0,
									"is_printed": false,
									"made_to": false,
									"menu_group": [
										"hahaha"
									],
									"kitchen_print": false
								}
							],
							"print_description": "",
							"deleted": false,
							"exists": false,
							"display_index": 0,
							"is_printed": false,
							"made_to": false,
							"menu_group": "Combo~10",
							"kitchen_print": false
						}
					]
				}
			},
			{
				"type": "setting",
				"data": {
					"printer_name": [
						"EPSON TM-T81 Receipt"
					],
					"print_type": "",
					"item_length": 30,
					"print_logo": false,
					"thankyou_note": "",
					"thankyou_note2": "",
					"printer_type": "POS"
				}
			},
			{
				"type": "separator",
				"data": {
					"separator_length": ""
				}
			},
			{
				"type": "columndetails",
				"data": {
					"columnheader": {
						"column1": "Tax",
						"column2": "Over",
						"column3": "",
						"column4": "tax"
					},
					"columndata": [
						{
							"column1": "0%",
							"column2": "0,00",
							"column3": "",
							"column4": "0,00"
						},
						{
							"column1": "9%",
							"column2": "10,00",
							"column3": "",
							"column4": "0,83"
						},
						{
							"column1": "21%",
							"column2": "0,00",
							"column3": "",
							"column4": "0,00"
						},
						{
							"column1": "Total",
							"column2": "10,00",
							"column3": "",
							"column4": "0,83"
						}
					]
				}
			},
			{
				"type": "Receipt",
				"data": {
					"align": "center",
					"receipt_text": [
						"hahaha"
					]
				}
			},
			{
				"type": "separator",
				"data": {
					"separator_length": ""
				}
			},
			{
				"type": "footer",
				"data": {
					"align": "center",
					"footer_text": [
						"Hotsport development agency",
						"350012, near dinning hall",
						"Bookdev",
						"Gujrat",
						"BTN - 85823648",
						"petorlrec@12gmail.com"
					]
				}
			}
		]
	}
};

const GIT_TEMPLATE_JSON = {
  "type": "git",
  "payload": { "repo": "my-app", "branch": "main", "action": "deploy" }
};

const DATABASE_JSON = {
  "connectionname": "xys",      
  "sql": "SELECT * FROM public.vandana"
};

const READ_FILE_JSON = {
  "type": "READ_FILE",
  "path": "test.txt"
};

const WRITE_FILE_JSON = {
  "type": "WRITE_FILE",
  "path": "test.txt",
  "content": "Hello from the JSON Test Page!"
};

const APPEND_FILE_JSON = {
  "type": "APPEND_FILE",
  "path": "test.txt",
  "content": "\nThis is a new appended line."
};


const ARABIC_PRINT_TEMPLATE = {
  "type": "print",
  "payload": {
    "printer_name": [
      "EPSON TM-m30 Receipt"
    ],
    "item_length": 31,
    "template": "2",
    "data": [
      {
        "type": "logo",
        "data": {
          "url": "https://app.esmartpos.com//assets//POS//logo//853560e6414b03d20c64a2ce9b1fc923.png"
        }
      },
      {
        "type": "summary",
        "data": {
          "summary": [
            {
              "key": "الإجمالي الفرعي",
              "value": 91.95
            }
          ]
        }
      },
      {
        "type": "header",
        "data": {
          "top_title": "",
          "sub_titles": [
            "العنوان 1",
            "العنوان 2"
          ],
          "address": [
            "#122 وسط المدينة"
          ],
          "bill_no": "13355",
          "ticket_no": "10",
          "date_of_bill": "3/3/2022",
          "prepration_date": "",
          "time": "11:32 ص",
          "print": "",
          "table": "",
          "online_order_id": "",
          "employee": "المستخدم 1",
          "till": "المحطة الطرفية 2",
          "order_type": "تناول في المطعم",
          "customer_name": "",
          "customer_phone": "",
          "customer_address": [
            "هاهاها"
          ],
          "customer_remarks": [
            "هاهاها"
          ],
          "split_bill_string": "",
          "headercomments": [
            "هاهاها"
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "item",
        "data": {
          "itemdata": [
            {
              "order_invoice_id": 13309,
              "item_amount": 46.98,
              "item_name": "بيتزا أوركارد سبيشال 3 رقم 1",
              "item_subLine": "",
              "toppings_with_price": [
                "هاهاها"
              ],
              "toppings": [
                "سكر",
                "ملح إضافي",
                "جبن"
              ],
              "quantity": 1,
              "selected": false,
              "price": 44.99,
              "custpmer_remarks": "",
              "printer_name": "",
              "printer_label": "",
              "station": "",
              "food_stampable": "",
              "items": [
                {
                  "order_invoice_id": "",
                  "item_amount": 0,
                  "item_name": "خبز بالثوم 1",
                  "item_subLine": "",
                  "toppings_with_price": [
                    "هاهاها"
                  ],
                  "toppings": [
                    "fg"
                  ],
                  "quantity": 0,
                  "selected": false,
                  "price": 0,
                  "custpmer_remarks": "",
                  "printer_name": "",
                  "printer_label": "",
                  "station": "",
                  "food_stampable": "",
                  "items": [
                    "we"
                  ],
                  "print_description": "",
                  "deleted": false,
                  "exists": false,
                  "display_index": 0,
                  "is_printed": false,
                  "made_to": false,
                  "menu_group": [
                    "هاهاها"
                  ],
                  "kitchen_print": false
                }
              ],
              "print_description": "",
              "deleted": false,
              "exists": false,
              "display_index": 0,
              "is_printed": false,
              "made_to": false,
              "menu_group": "كومبو~10",
              "kitchen_print": false
            },
            {
              "order_invoice_id": 13309,
              "item_amount": 46.98,
              "item_name": "بطاطس مقلية فرنسية",
              "item_subLine": "",
              "toppings_with_price": [
                "هاهاها"
              ],
              "toppings": [],
              "quantity": 1,
              "selected": false,
              "price": 44.99,
              "custpmer_remarks": "",
              "printer_name": "",
              "printer_label": "",
              "station": "",
              "food_stampable": "",
              "items": [
                {
                  "order_invoice_id": "",
                  "item_amount": 0,
                  "item_name": "ريندر ميست",
                  "item_subLine": "",
                  "toppings_with_price": [
                    "هاهاها"
                  ],
                  "toppings": [
                    "ملح",
                    "صوص إضافي",
                    "فلفل حار"
                  ],
                  "quantity": 0,
                  "selected": false,
                  "price": 0,
                  "custpmer_remarks": "",
                  "printer_name": "",
                  "printer_label": "",
                  "station": "",
                  "food_stampable": "",
                  "items": [
                    "we"
                  ],
                  "print_description": "",
                  "deleted": false,
                  "exists": false,
                  "display_index": 0,
                  "is_printed": false,
                  "made_to": false,
                  "menu_group": [
                    "هاهاها"
                  ],
                  "kitchen_print": false
                }
              ],
              "print_description": "",
              "deleted": false,
              "exists": false,
              "display_index": 0,
              "is_printed": false,
              "made_to": false,
              "menu_group": "كومبو~10",
              "kitchen_print": false
            }
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "bigsummary",
        "data": {
          "bigsummary": [
            {
              "key": "الإجمالي الفرعي",
              "value": 91.95
            },
            {
              "key": "الإجمالي",
              "value": 43.96
            },
            {
              "key": "المبلغ المدفوع",
              "value": 43.96
            },
            {
              "key": "إجمالي الضريبة",
              "value": 5.73
            }
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "item",
        "data": {
          "itemdata": [
            {
              "order_invoice_id": 13309,
              "item_amount": 46.98,
              "item_name": "بيتزا أوركارد سبيشال 3",
              "item_subLine": "",
              "toppings_with_price": [
                "هاهاها"
              ],
              "toppings": [
                "سكر",
                "ملح إضافي",
                "جبن"
              ],
              "quantity": 1,
              "selected": false,
              "price": 44.99,
              "custpmer_remarks": "",
              "printer_name": "",
              "printer_label": "",
              "station": "",
              "food_stampable": "",
              "items": [
                {
                  "order_invoice_id": "",
                  "item_amount": 0,
                  "item_name": "خبز بالثوم 1",
                  "item_subLine": "",
                  "toppings_with_price": [
                    "هاهاها"
                  ],
                  "toppings": [
                    "fg"
                  ],
                  "quantity": 0,
                  "selected": false,
                  "price": 0,
                  "custpmer_remarks": "",
                  "printer_name": "",
                  "printer_label": "",
                  "station": "",
                  "food_stampable": "",
                  "items": [
                    "we"
                  ],
                  "print_description": "",
                  "deleted": false,
                  "exists": false,
                  "display_index": 0,
                  "is_printed": false,
                  "made_to": false,
                  "menu_group": [
                    "هاهاها"
                  ],
                  "kitchen_print": false
                }
              ],
              "print_description": "",
              "deleted": false,
              "exists": false,
              "display_index": 0,
              "is_printed": false,
              "made_to": false,
              "menu_group": "كومبو~10",
              "kitchen_print": false
            },
            {
              "order_invoice_id": 13309,
              "item_amount": 46.98,
              "item_name": "بطاطس مقلية فرنسية",
              "item_subLine": "",
              "toppings_with_price": [
                    "هاهاها"
              ],
              "toppings": [],
              "quantity": 1,
              "selected": false,
              "price": 44.99,
              "custpmer_remarks": "",
              "printer_name": "",
              "printer_label": "",
              "station": "",
              "food_stampable": "",
              "items": [
                {
                  "order_invoice_id": "",
                  "item_amount": 0,
                  "item_name": "ريندر ميست",
                  "item_subLine": "",
                  "toppings_with_price": [
                    "هاهاها"
                  ],
                  "toppings": [
                    "ملح",
                    "صوص إضافي",
                    "فلفل حار"
                  ],
                  "quantity": 0,
                  "selected": false,
                  "price": 0,
                  "custpmer_remarks": "",
                  "printer_name": "",
                  "printer_label": "",
                  "station": "",
                  "food_stampable": "",
                  "items": [
                    "we"
                  ],
                  "print_description": "",
                  "deleted": false,
                  "exists": false,
                  "display_index": 0,
                  "is_printed": false,
                  "made_to": false,
                  "menu_group": [
                    "هاهاها"
                  ],
                  "kitchen_print": false
                }
              ],
              "print_description": "",
              "deleted": false,
              "exists": false,
              "display_index": 0,
              "is_printed": false,
              "made_to": false,
              "menu_group": "كومبو~10",
              "kitchen_print": false
            }
          ]
        }
      },
      {
        "type": "setting",
        "data": {
          "printer_name": [
            "إبسون TM-T81 إيصال"
          ],
          "print_type": "",
          "item_length": 30,
          "print_logo": false,
          "thankyou_note": "",
          "thankyou_note2": "",
          "printer_type": "نقاط البيع"
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "columndetails",
        "data": {
          "columnheader": {
            "column1": "الضريبة",
            "column2": "على",
            "column3": "",
            "column4": "الضريبة"
          },
          "columndata": [
            {
              "column1": "0%",
              "column2": "0,00",
              "column3": "",
              "column4": "0,00"
            },
            {
              "column1": "9%",
              "column2": "10,00",
              "column3": "",
              "column4": "0,83"
            },
            {
              "column1": "21%",
              "column2": "0,00",
              "column3": "",
              "column4": "0,00"
            },
            {
              "column1": "الإجمالي",
              "column2": "10,00",
              "column3": "",
              "column4": "0,83"
            }
          ]
        }
      },
      {
        "type": "Receipt",
        "data": {
          "align": "center",
          "receipt_text": [
            "هاهاها"
          ]
        }
      },
      {
        "type": "separator",
        "data": {
          "separator_length": ""
        }
      },
      {
        "type": "footer",
        "data": {
          "align": "center",
          "footer_text": [
            "وكالة تطوير هوتسبورت",
            "350012، بالقرب من قاعة الطعام",
            "بوك ديف",
            "غوجرات",
            "BTN - 85823648",
            "petorlrec@12gmail.com"
          ]
        }
      }
    ]
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [jsonInput, setJsonInput] = useState<string>('');
  const [resultData, setResultData] = useState<string>('');
  const [isMuulBrowser, setIsMuulBrowser] = useState<boolean>(false);
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [lastSentJson, setLastSentJson] = useState<string>('');

  
  // Form/File Mode State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [commandType, setCommandType] = useState<string>('GIT_ZIP');
  const [credentialId, setCredentialId] = useState<string>('1');
  const [destination, setDestination] = useState<'github' | 'local' | 'both'>('github');
  const [pathInRepo, setPathInRepo] = useState<string>('');

  // Git Pull Specific State
  const [pullRepo, setPullRepo] = useState<string>('');
  const [pullBranch, setPullBranch] = useState<string>('main');

  // Status State
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'idle'; message: string; details?: string }>({
    type: 'idle',
    message: ''
  });

  // Detection logic for Muul Browser
  useEffect(() => {
    const detectMuul = () => {
      const hasBridge = !!window.externalMessage;
      const hasCustomUA = navigator.userAgent.includes('Muul') || navigator.userAgent.includes('Electron');
      const detected = hasBridge || hasCustomUA;
      setIsMuulBrowser(detected);
      
      console.log(
        `%c[MUUL DETECTION] Environment: ${detected ? 'MUUL BROWSER' : 'STANDARD BROWSER'} | Bridge: ${hasBridge ? 'FOUND' : 'MISSING'}`,
        `color: white; background: ${detected ? '#10b981' : '#f43f5e'}; padding: 4px 8px; border-radius: 4px; font-weight: bold;`
      );
    };
    detectMuul();
  }, []);

  const performDevToolsLog = useCallback((type: 'SENT' | 'RECEIVED' | 'ERROR', content: any, handlerStatus: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const isMuulOrigin = !!window.externalMessage;
    
    let color = '#3b82f6'; // Sent (Blue)
    if (type === 'RECEIVED') color = '#10b981'; // Received (Green)
    if (type === 'ERROR') color = '#ef4444'; // Error (Red)

    console.group(`%c${type} [${timestamp}]`, `color: ${color}; font-weight: bold; font-size: 11px;`);
    console.log(`%cHandler Status: %c${handlerStatus}`, "font-weight: bold;", "color: #6b7280;");
    console.log(`%cMuul Origin:    %c${isMuulOrigin ? 'YES ✅ (Bridge Active)' : 'NO ❌ (Normal Browser)'}`, "font-weight: bold;", isMuulOrigin ? "color: #10b981;" : "color: #f43f5e;");
    console.log("%cPayload:", "font-weight: bold;");
    console.log(content);
    console.groupEnd();
  }, []);

  // --- External Bridge Logic ---
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && (event.data.type === 'SAVED_CREDENTIALS_RESPONSE' || event.data.credentials)) {
        const content = typeof event.data === 'string' ? event.data : JSON.stringify(event.data, null, 2);
        setResultData(content);
        setStatus({ type: 'success', message: 'Data received via postMessage' });
        performDevToolsLog('RECEIVED', event.data, 'Window PostMessage Handler');
      }
    };

    const handleExternalResult = (e: any) => {
      const data = e.detail !== undefined ? e.detail : e;
      setResultData(typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data));
      setStatus({ type: 'success', message: 'Pushed reply received via event listener' });
      performDevToolsLog('RECEIVED', data, 'External Event Handler');
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('external:result', handleExternalResult);

    window.updateBrowserResult = (data: any) => {
      const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      setResultData(content);
      setStatus({ type: 'success', message: 'Result updated via global helper' });
      performDevToolsLog('RECEIVED', data, 'Global Helper (updateBrowserResult)');
    };

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('external:result', handleExternalResult);
      delete window.updateBrowserResult;
    };
  }, [performDevToolsLog]);

  const resetStatus = () => setStatus({ type: 'idle', message: '' });

  const handlePdfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB guard
      setStatus({ type: 'error', message: 'File too large', details: 'PDF size exceeds 10MB. Base64 encoding might fail or be extremely slow.' });
      return;
    }

    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPdfDataUrl(reader.result as string);
      setStatus({ type: 'success', message: 'PDF loaded and ready to print.' });
    };
    reader.readAsDataURL(file);
  };

  const fillJson = (data: any) => {
    setJsonInput(JSON.stringify(data, null, 2));
    resetStatus();
  };

  const handleFetchCredentials = async () => {
    const cmdObj = { type: 'GET_SAVED_CREDENTIALS', requestId: 'list-' + Date.now() };
    const cmdStr = JSON.stringify(cmdObj);
    setJsonInput(cmdStr);
    setLastSentJson(cmdStr);
    setLastRequestId(null); // Not a folder request
    resetStatus();
    
    const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
    performDevToolsLog('SENT', cmdObj, hStatus);

    try {
      if (window.externalMessage?.send) {
        const res = await window.externalMessage.send(cmdStr);
        setResultData(JSON.stringify(res || [], null, 2));
        setStatus({ type: 'success', message: 'Credentials received' });
        performDevToolsLog('RECEIVED', res, 'Bridge Response');
      }
    } catch (e: any) {
      setStatus({ type: 'error', message: 'Fetch failed', details: e.message });
      performDevToolsLog('ERROR', e.message, 'Handler Exception');
    }
  };

  const handleSendText = async () => {
    if (!jsonInput.trim()) {
      setStatus({ type: 'error', message: 'Please enter JSON content.' });
      return;
    }
    setLastRequestId(null); // Not a folder request
    resetStatus();
    try {
      let parsed = JSON.parse(jsonInput);
      if (typeof parsed === 'object' && parsed !== null && !parsed.requestId) {
        parsed.requestId = 'req-' + Date.now();
      }
      const cmd = JSON.stringify(parsed);
      setJsonInput(cmd);
      setLastSentJson(cmd);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', parsed, hStatus);

      if (window.externalMessage?.send) {
        const res = await window.externalMessage.send(cmd);
        setResultData(JSON.stringify(res, null, 2));
        setStatus({ type: 'success', message: 'Command Sent and Response Captured' });
        performDevToolsLog('RECEIVED', res, 'Bridge Response');
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: 'Execution Error', details: error.message });
      performDevToolsLog('ERROR', error.message, 'JSON Parse Error');
    }
  };

  const handleExecuteFormCommand = async () => {
    setLastRequestId(null); // Not a folder request
    resetStatus();

    if (commandType === 'print_pdf') {
      if (!pdfDataUrl) {
        setStatus({ type: 'error', message: 'Please select a PDF file first.' });
        return;
      }

      const payload = {
        type: "print_pdf",
        requestId: "pdf-" + Date.now(),
        payload: {
          printer_name: ["pos"],
          fileName: pdfFileName,
          pdfDataUrl: pdfDataUrl,
          dpi: 203,
          widthPx: 576,
          sliceHeightPx: 200,
          fitMode: "fitWidth"
        }
      };

      const payloadStr = JSON.stringify(payload);
      setJsonInput(payloadStr);
      setLastSentJson(payloadStr);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', { ...payload, payload: { ...payload.payload, pdfDataUrl: '(base64-pdf-content)' } }, hStatus);

      try {
        if (window.externalMessage?.send) {
          const res = await window.externalMessage.send(payloadStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'PDF Print Command Sent!' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: 'PDF Print failed', details: err.message });
        performDevToolsLog('ERROR', err.message, 'Handler Exception');
      }
      return;
    }

    if (commandType === 'GIT_PULL') {
      if (!pullRepo.trim()) {
        setStatus({ type: 'error', message: 'Repository name is required for Pull.' });
        return;
      }
      const payload = {
        type: 'GIT_PULL',
        repo: pullRepo,
        branch: pullBranch,
        path: pathInRepo,
        requestId: 'pull-' + Date.now()
      };
      const payloadStr = JSON.stringify(payload);
      setJsonInput(payloadStr);
      setLastSentJson(payloadStr);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', payload, hStatus);

      try {
        if (window.externalMessage?.send) {
          const res = await window.externalMessage.send(payloadStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'Git Pull Executed!' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: 'Pull failed', details: err.message });
        performDevToolsLog('ERROR', err.message, 'Handler Exception');
      }
      return;
    }

    if (!selectedFile) {
      setStatus({ type: 'error', message: 'Please select a file.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const payload = {
        type: commandType,
        name: selectedFile.name,
        dataUrl: reader.result,
        target: destination,
        credentialId,
        pathInRepo,
        requestId: 'file-' + Date.now()
      };
      const payloadStr = JSON.stringify(payload);
      setJsonInput(payloadStr);
      setLastSentJson(payloadStr);
      
      const hStatus = window.externalMessage?.send ? 'Passing to Bridge Handler' : 'Simulating (Bridge Missing)';
      performDevToolsLog('SENT', { ...payload, dataUrl: '(base64-content)' }, hStatus);

      try {
        if (window.externalMessage?.send) {
          const res = await window.externalMessage.send(payloadStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'File Command Sent!' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
        }
      } catch (err: any) {
        setStatus({ type: 'error', message: 'File send failed', details: err.message });
        performDevToolsLog('ERROR', err.message, 'Handler Exception');
      }
    };
    reader.readAsDataURL(selectedFile);
  };
  
  const handleGetSavedFolder = async () => {
      setLastRequestId(null); // Not a folder request
      resetStatus();
      const cmdObj = { type: 'GET_LOCAL_CONFIG', requestId: 'get-' + Date.now() };
      const cmdStr = JSON.stringify(cmdObj);
      setJsonInput(cmdStr);
      setLastSentJson(cmdStr);
      
      performDevToolsLog('SENT', cmdObj, 'Bridge Handler');

      if (!window.externalMessage?.send) {
          setStatus({ type: 'error', message: 'externalMessage bridge not available, open this page in MuulBrowser' });
          return;
      }

      try {
          const res = await window.externalMessage.send(cmdStr);
          setResultData(JSON.stringify(res, null, 2));
          setStatus({ type: 'success', message: 'Saved folder config received.' });
          performDevToolsLog('RECEIVED', res, 'Bridge Response');
      } catch (e: any) {
          setStatus({ type: 'error', message: 'Get config failed', details: e.message });
          performDevToolsLog('ERROR', e.message, 'Handler Exception');
      }
  };

  const handleFetchFolderDetails = async () => {
    resetStatus();
    const requestId = 'details-' + Date.now();
    const cmdObj = { type: 'GET_FOLDER_DETAILS', requestId };
    const cmdStr = JSON.stringify(cmdObj);
    setJsonInput(cmdStr);
    setLastSentJson(cmdStr);
    setLastRequestId(requestId); // Track this specific request
    
    performDevToolsLog('SENT', cmdObj, 'Bridge Handler');

    if (!window.externalMessage?.send) {
        setStatus({ type: 'error', message: 'externalMessage bridge not available, open this page in MuulBrowser' });
        return;
    }

    try {
        const res = await window.externalMessage.send(cmdStr);
        setResultData(JSON.stringify(res, null, 2));
        setStatus({ type: 'success', message: 'Folder details received.' });
        performDevToolsLog('RECEIVED', res, 'Bridge Response');
    } catch (e: any) {
        setStatus({ type: 'error', message: 'Fetch folder details failed', details: e.message });
        performDevToolsLog('ERROR', e.message, 'Handler Exception');
    }
  };

  const handleFileOperation = async (type: 'READ_FILE' | 'WRITE_FILE' | 'APPEND_FILE', path: string, content?: string) => {
    resetStatus();
    setLastRequestId(null);
    const requestId = `${type.toLowerCase()}-${Date.now()}`;
    
    const cmdObj: {type: string, path: string, content?: string, requestId: string} = { type, path, requestId };
    if (content !== undefined) {
      cmdObj.content = content;
    }
    
    const cmdStr = JSON.stringify(cmdObj);
    setJsonInput(cmdStr);
    setLastSentJson(cmdStr);

    performDevToolsLog('SENT', cmdObj, 'Bridge Handler');

    if (!window.externalMessage?.send) {
      setStatus({ type: 'error', message: 'externalMessage bridge not available' });
      return;
    }

    try {
      const res = await window.externalMessage.send(cmdStr);
      setResultData(JSON.stringify(res, null, 2));
      setStatus({ type: 'success', message: `${type} operation successful.` });
      performDevToolsLog('RECEIVED', res, 'Bridge Response');
    } catch (e: any) {
      setStatus({ type: 'error', message: `${type} operation failed`, details: e.message });
      performDevToolsLog('ERROR', e.message, 'Handler Exception');
    }
  };


  const clearResult = () => {
    setResultData('');
    setLastSentJson('');
    setLastRequestId(null);
  }

  // Memoize parsing to prevent re-renders
  const resultViewContent = useMemo(() => {
    if (!resultData) {
      return null;
    }
    try {
      const parsedData = JSON.parse(resultData);
      // Check if it's the folder structure response we're expecting
      if (
        parsedData.requestId && parsedData.requestId.startsWith('details-') &&
        typeof parsedData.isDirectory === 'boolean' &&
        parsedData.name
      ) {
        return <FolderTreeView node={parsedData as FilesystemNode} />;
      }
    } catch (e) {
      // Not valid JSON, or not the folder structure, fall through to default view
    }
    return 'default'; // Fallback to default textarea
  }, [resultData, lastRequestId]);


  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center font-sans">
      {/* Muul Connection Banner */}
      {isMuulBrowser && (
        <div className="w-full bg-blue-600 text-white text-[10px] font-bold py-1.5 px-4 text-center uppercase tracking-widest animate-in slide-in-from-top duration-500 shadow-md">
          json test page connected to Muul Browser
        </div>
      )}

      <div className="p-6 flex flex-col items-center w-full">
        <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl items-start justify-center">
          
          {/* Main Command Card */}
          <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
              <h1 className="text-white font-bold text-lg">JSON Test Page</h1>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${isMuulBrowser ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'}`}>
                {isMuulBrowser ? 'Muul Mode' : 'Web Mode'}
              </span>
            </div>

            <div className="flex bg-gray-100 p-1 m-4 rounded-lg">
              <button
                onClick={() => { setActiveTab('text'); resetStatus(); }}
                className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${activeTab === 'text' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                JSON Text
              </button>
              <button
                onClick={() => { setActiveTab('file'); resetStatus(); }}
                className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${activeTab === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Command Form
              </button>
            </div>

            <div className="px-6 pb-6 space-y-4">
              {activeTab === 'text' ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => fillJson(PRINT_JSON)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Print Template</button>
                    <button onClick={() => fillJson(GIT_TEMPLATE_JSON)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Git Template</button>
                    <button onClick={() => fillJson(DATABASE_JSON)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">DB Query</button>
                    <button onClick={() => handleFileOperation('READ_FILE', READ_FILE_JSON.path)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Read File</button>
                    <button onClick={() => handleFileOperation('WRITE_FILE', WRITE_FILE_JSON.path, WRITE_FILE_JSON.content)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Write File</button>
                    <button onClick={() => handleFileOperation('APPEND_FILE', APPEND_FILE_JSON.path, APPEND_FILE_JSON.content)} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Append File</button>
                    <button onClick={handleFetchCredentials} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Fetch Creds</button>
                    <button onClick={handleGetSavedFolder} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Get Folder</button>
                    <button onClick={handleFetchFolderDetails} className="flex-1 text-[10px] py-2 bg-gray-50 border border-gray-200 rounded font-bold text-gray-600 hover:bg-gray-100 uppercase tracking-tighter">Fetch Details</button>
                  </div>
                  <textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{ "type": "COMMAND" }'
                    className={`w-full h-64 p-4 rounded-lg border bg-gray-50 text-xs font-mono focus:ring-2 focus:ring-blue-100 focus:outline-none transition-all resize-none ${status.type === 'error' ? 'border-red-300' : 'border-gray-200'}`}
                    spellCheck={false}
                  />
                  <button onClick={handleSendText} className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-bold text-sm shadow-md transition-all uppercase tracking-widest">Send JSON Command</button>
                </div>
              ) : (
                <div className="space-y-4">
                   <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Command Type</label>
                    <select value={commandType} onChange={(e) => setCommandType(e.target.value)} className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none">
                      <option value="GIT_ZIP">GIT_ZIP (Push)</option>
                      <option value="GIT_FILE">GIT_FILE (Push)</option>
                      <option value="GIT_PULL">GIT_PULL (Pull from Remote)</option>
                      <option value="DATABASE">DATABASE</option>
                      <option value="print_pdf">print_pdf (PDF Printing)</option>
                    </select>
                  </div>

                  {commandType === 'GIT_PULL' && (
                    <div className="space-y-3 animate-in fade-in duration-300">
                      <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Repository Name</label>
                        <input type="text" value={pullRepo} onChange={(e) => setPullRepo(e.target.value)} placeholder="owner/repo" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Branch</label>
                          <input type="text" value={pullBranch} onChange={(e) => setPullBranch(e.target.value)} placeholder="main" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Sub-path (Opt)</label>
                          <input type="text" value={pathInRepo} onChange={(e) => setPathInRepo(e.target.value)} placeholder="/" className="w-full mt-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs" />
                        </div>
                      </div>
                    </div>
                  )}

                  {commandType === 'print_pdf' && (
                    <div className="animate-in fade-in duration-300 space-y-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select PDF File</label>
                      <input 
                        type="file" 
                        accept="application/pdf"
                        onChange={handlePdfChange} 
                        className="mt-1 w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 cursor-pointer" 
                      />
                      {pdfFileName && (
                        <p className="text-[9px] text-gray-500 italic ml-1">Selected: {pdfFileName}</p>
                      )}
                    </div>
                  )}

                  {commandType !== 'GIT_PULL' && commandType !== 'print_pdf' && (
                    <div className="animate-in fade-in duration-300">
                      <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Select Local File</label>
                      <input type="file" onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])} className="mt-1 w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer" />
                    </div>
                  )}
                  
                  <button onClick={handleExecuteFormCommand} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-md transition-all uppercase tracking-widest">
                    {commandType === 'GIT_PULL' ? 'Execute Git Pull' : commandType === 'print_pdf' ? 'Print PDF' : 'Send File Content'}
                  </button>
                </div>
              )}

              {status.type !== 'idle' && (
                <div className={`p-3 rounded-lg border text-[11px] flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${status.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
                  <div className="flex-1">
                    <p className="font-bold">{status.message}</p>
                    {status.details && <p className="mt-0.5 opacity-70 font-mono text-[9px]">{status.details}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Result Card */}
          <div className="w-full lg:w-1/2 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden flex flex-col self-stretch">
            <div className="bg-green-600 px-6 py-4 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Result View</h2>
              <div className="flex gap-2">
                <button onClick={clearResult} className="text-[10px] font-bold text-white uppercase tracking-widest bg-green-700 hover:bg-green-800 px-2 py-1 rounded transition-colors">Clear</button>
                {resultData && resultViewContent === 'default' && (
                  <button onClick={() => { setJsonInput(resultData); resetStatus(); }} className="text-[10px] font-bold text-white uppercase tracking-widest bg-green-500 hover:bg-green-400 px-2 py-1 rounded transition-colors">Copy to Input</button>
                )}
              </div>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Incoming Browser Response</label>
                {resultData && <span className="text-[10px] text-green-600 font-bold animate-pulse">Updated</span>}
              </div>
              <div className="relative flex-1 group">
                {resultViewContent === 'default' ? (
                    <div className="absolute inset-0 bg-gray-900 rounded-lg shadow-inner overflow-hidden border border-gray-800">
                      <textarea readOnly value={resultData} placeholder="Waiting for bridge activity..." className="w-full h-full p-4 bg-transparent text-green-400 text-xs font-mono leading-relaxed focus:outline-none resize-none placeholder-gray-600" />
                    </div>
                ) : (
                  <div className="absolute inset-0 bg-gray-50 rounded-lg shadow-inner overflow-auto border border-gray-200 p-4">
                    {resultViewContent}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Last Sent JSON Debug View */}
        {lastSentJson && (
          <div className="w-full max-w-6xl mt-6 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gray-700 px-4 py-2 flex items-center justify-between">
              <h3 className="text-white text-[10px] font-bold uppercase tracking-widest">Last Sent JSON (Debug)</h3>
              <button 
                onClick={() => setLastSentJson('')}
                className="text-[9px] text-gray-400 hover:text-white uppercase font-bold"
              >
                Hide
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <pre className="text-[9px] font-mono text-gray-600 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                {lastSentJson}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-12 mb-8 text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isMuulBrowser ? 'bg-blue-500 animate-pulse' : 'bg-gray-300'}`}></div>
            {isMuulBrowser ? 'Muul Browser Bridge Active' : 'Native Bridge Missing'}
          </div>
          <p className="opacity-60 text-center">Open Browser DevTools (F12 / Cmd+Opt+I) to view detailed operation logs & origin checks</p>
        </div>
      </div>
    </div>
  );
}
